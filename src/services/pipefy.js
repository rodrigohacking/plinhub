const PIPEFY_API_URL = typeof window === 'undefined' ? 'https://api.pipefy.com/graphql' : '/api/pipefy'; // Backend Proxy for Browser, Direct for Node

const KNOWN_ROBUST_CONFIGS = {
  // ANDAR SEGUROS
  '306438109': {
    name: 'Andar Seguros (Zero-Config)',
    wonPhase: 'Apólice Emitida',
    wonPhaseId: '338889923', // Primary Won Phase
    lostPhase: 'Perdido',
    lostPhaseId: '338889931', // CRITICAL: Verified ID
    qualifiedPhase: 'Cotação',
    valueField: 'Prêmio Líquido',
    lossReasonField: 'Motivo Recusa'
  },
  // APOLAR
  '305634232': {
    name: 'Apolar (Zero-Config)',
    wonPhase: 'Contrato Assinado (Ganho)',
    lostPhase: 'Perdido',
    lostPhaseId: '338889931', // Assuming similar structure or standard ID if known, otherwise rely on name
    qualifiedPhase: 'Em Contato',
    valueField: 'Valor mensal dos honorários administrativos',
    lossReasonField: 'Motivo Recusa' // Standardizing on "Motivo Recusa" or similar
  }
};

// Backend Proxy handles Auth now
export async function fetchPipefyDeals(orgId, pipeId, token, userConfig = {}, searchTerm = null) {
  console.log(`[Pipefy] Starting fetch for Org: ${orgId}, Pipe: ${pipeId}`);
  if (!pipeId) {
    console.warn('[Pipefy] Missing PipeID');
    return [];
  }
  // Token is properly optional now as backend handles it, but we keep the arg for signature compatibility

  // ZERO-CONFIG LOGIC: Override user config if Pipe ID is known
  let config = { ...userConfig };
  const knownConfig = KNOWN_ROBUST_CONFIGS[String(pipeId).trim()];

  if (knownConfig) {
    console.log(`[Pipefy] 🔒 Zero-Config Activated for ${knownConfig.name}. Ignoring manual mapping.`);
    config = { ...config, ...knownConfig };
  }

  let allEdges = [];
  let hasPreviousPage = true;
  let startCursor = null;
  let pageCount = 0;

  // Fields to fetch
  const queryFields = `
    edges {
      node {
        id
        title
        finished_at
        updated_at
        current_phase { name id }
        labels { name }
        fields { name value }
        createdAt
        created_at
        due_date
        assignees { name }
      }
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  `;

  try {
    // 1. Get All Phases
    const phasesQuery = `{ pipe(id: ${pipeId}) { phases { id name cards_count } } }`;
    const phasesRes = await fetch(PIPEFY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query: phasesQuery })
    });

    if (!phasesRes.ok) {
      const errJson = await phasesRes.json().catch(() => ({}));
      const detailedError = errJson.error?.message || errJson.error || `Erro ${phasesRes.status}: ${phasesRes.statusText}` || 'Erro na conexão com Pipefy';
      throw new Error(detailedError);
    }

    const phasesJson = await phasesRes.json();
    if (phasesJson.errors) {
      console.error('[Pipefy] Error fetching phases:', phasesJson.errors);
      throw new Error(phasesJson.errors[0]?.message || 'Erro GraphQL desconhecido');
    }

    if (phasesJson.error) {
      throw new Error(phasesJson.error.message || phasesJson.error);
    }

    const phases = phasesJson.data?.pipe?.phases || [];
    console.log(`[Pipefy] Fetching ALL cards for ${phases.length} phases...`);

    // 2. Fetch Cards for ALL Phases (Balanced Parallel - Batch 2 is safer for deep reliability)
    const BATCH_SIZE = 2;
    for (let i = 0; i < phases.length; i += BATCH_SIZE) {
      const batch = phases.slice(i, i + BATCH_SIZE);
      console.log(`[Pipefy] Fetching batch ${i / BATCH_SIZE + 1}/${Math.ceil(phases.length / BATCH_SIZE)} (Reliable Mode)...`);

      await Promise.all(batch.map(async (phase) => {
        let phaseEdges = [];
        let hasNext = true;
        let cursor = null;
        let retryCount = 0;
        let pageCount = 0;

        console.log(`[Pipefy] Fetching phase: ${phase.name} (ID: ${phase.id})...`);

        while (hasNext) {
          // OPTIMIZATION: Precision Limit for 2233 Cards
          // User has ~2300 cards total. A limit of 40 pages (2000) CUTS data if one phase is huge.
          // Setting limit to 100 pages (100 * 50 = 5000 cards PER PHASE).
          // This safely covers the entire pipe while preventing infinite loops.
          if (pageCount > 100) {
            console.warn(`[Pipefy] Safety Break: Phase ${phase.name} exceeded 5000 items (100 pages). Stopping.`);
            break;
          }
          pageCount++;

          const q = `
                    {
                        phase(id: ${phase.id}) {
                            cards(first: 50, after: ${cursor ? `"${cursor}"` : null}${searchTerm ? `, search: {title: "${searchTerm}"}` : ''}) {
                                edges {
                                    node {
                                        id
                                        title
                                        finished_at
                                        updated_at
                                        current_phase { name id }
                                        labels { name }
                                        fields { name value }
                                        createdAt
                                        created_at
                                        due_date
                                        assignees { name }
                                    }
                                }
                                pageInfo { hasNextPage endCursor }
                            }
                        }
                    }`;

          try {
            const res = await fetch(PIPEFY_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ query: q })
            });

            if (res.status === 429) {
              retryCount++;
              if (retryCount > 3) { // Reduced max retries
                console.error(`[Pipefy] Max retries reached for phase ${phase.name}. Skipping.`);
                break; // Stop trying for this page
              }
              // Capped Exponential Backoff: Max 5 seconds
              const waitTime = Math.min(5000, 1000 * Math.pow(2, retryCount - 1));
              console.warn(`[Pipefy] Rate Limit (429) for ${phase.name}. Waiting ${waitTime}ms...`);
              await new Promise(r => setTimeout(r, waitTime));
              continue;
            }
            retryCount = 0;

            const json = await res.json();
            if (json.errors) break;

            const edges = json.data?.phase?.cards?.edges || [];
            if (edges.length === 0) break;

            phaseEdges.push(...edges);
            hasNext = json.data.phase.cards.pageInfo.hasNextPage;
            cursor = json.data.phase.cards.pageInfo.endCursor;
          } catch (err) {
            console.error(`[Pipefy] Network Error phase ${phase.name}:`, err);
            break;
          }
        }
        allEdges.push(...phaseEdges.map(e => ({ ...e, phaseName: phase.name })));
      }));
    }

    // Deduplicate logic happens after the loop...

    // ...

    // Deduplicate (Safety check, though sequential shouldn't dup)
    const uniqueMap = new Map();
    allEdges.forEach(e => uniqueMap.set(e.node.id, e));
    allEdges = Array.from(uniqueMap.values());

    console.log(`[Pipefy] Total cards fetched (Parallel Strategy): ${allEdges.length}`);

    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    // Map to Dashboard Deal Model
    const mappedDeals = allEdges.map(edge => {
      const card = edge.node;

      // 1. Value Mapping (Improved)
      let valueField = null;

      if (config.valueField) {
        const cfgVal = normalize(config.valueField);
        valueField = card.fields.find(f => {
          const fName = normalize(f.name);
          return fName === cfgVal || fName.includes(cfgVal);
        });
      }

      if (!valueField) {
        valueField = card.fields.find(f => {
          const name = normalize(f.name);
          return name.includes('valor') || name.includes('price') || name.includes('receita') || name.includes('mensalidade') || name.includes('premio');
        });
      }

      let amount = 0;
      if (valueField && valueField.value) {
        let v = valueField.value.toString();
        // Remove currency symbols and format
        v = v.replace(/[R$\sA-Za-z]/g, '').trim();

        // Simple robust parser for "1.200,50" -> 1200.50
        if (v.includes(',') && v.includes('.')) {
          v = v.replace(/\./g, '').replace(',', '.');
        } else if (v.includes(',')) {
          v = v.replace(',', '.');
        }

        amount = parseFloat(v) || 0;
      }

      // 2. Status Mapping (STRICT SPEC FROM USER)
      // "Todo card que ESTÁ ou FOI MOVIDO para a fase Negócio Perdido (ID 338889931)"
      let status = 'new';

      const phaseName = (card.current_phase?.name?.toLowerCase() || '').trim();
      const phaseId = String(card.current_phase?.id || '').trim();

      const normPhaseName = normalize(phaseName);

      // Configured IDs and Names
      // Support multiple IDs via comma separation
      const parseIds = (str) => (str || '').split(',').map(s => s.trim()).filter(Boolean);

      const CFG_LOST_IDS = parseIds(config.lostPhaseId);
      const CFG_LOST_NAME_NORM = config.lostPhase ? normalize(config.lostPhase) : null;

      const CFG_WON_IDS = parseIds(config.wonPhaseId);
      const CFG_WON_NAME_NORM = config.wonPhase ? normalize(config.wonPhase) : null;

      const CFG_QUAL_ID = (config.qualifiedPhaseId || '').trim();
      const CFG_QUAL_NAME_NORM = config.qualifiedPhase ? normalize(config.qualifiedPhase) : null;

      // A. LOST (Priority Logic as per Spec)
      if (phaseId === '338889931' || // Explicit ID from Spec
        CFG_LOST_IDS.includes(phaseId) ||
        (CFG_LOST_NAME_NORM && normPhaseName === CFG_LOST_NAME_NORM) || /* Exact Config Match */
        normPhaseName.includes('perdido') ||
        normPhaseName.includes('negocio perdido') ||
        normPhaseName.includes('lost') ||
        normPhaseName.includes('cancelado')) {
        status = 'lost';
      }


      // B. WON
      else if (
        CFG_WON_IDS.includes(phaseId) ||
        (CFG_WON_NAME_NORM && normPhaseName === CFG_WON_NAME_NORM) || /* Exact Config Match */
        normPhaseName.includes('ganho') ||
        normPhaseName.includes('vendido') ||
        normPhaseName.includes('fechado') ||
        normPhaseName.includes('contrato assinado') ||
        normPhaseName.includes('apolice emitida') || // Insurance Specific
        normPhaseName.includes('implantacao') || // Onboarding
        normPhaseName.includes('enviado ao cliente') || // User Request: explicit acceptance
        normPhaseName.includes('assinado')) {
        status = 'won';
      }
      // C. QUALIFIED
      else if ((CFG_QUAL_ID && phaseId === CFG_QUAL_ID) ||
        (CFG_QUAL_NAME_NORM && normPhaseName === CFG_QUAL_NAME_NORM) ||
        normPhaseName.includes('qualificado') ||
        normPhaseName.includes('potencial') ||
        normPhaseName.includes('negociacao')) {
        status = 'qualified';
      }

      // 3. Date Mapping (STRICT SPEC FROM USER)
      // "Para Leads Perdidos: USAR EXCLUSIVAMENTE a data de criação do card"
      let dealDate;
      const createdDate = card.createdAt || card.created_at;

      // New Priority: Search for explicit "Sale Date" field to override everything
      // This solves the "Edit Side Effect" -> User can freeze date by filling this field
      const explicitDateField = card.fields?.find(f => {
        const n = normalize(f.name);
        return n.includes('data da venda') || n.includes('data de fechamento') || n.includes('closing date') || n.includes('data venda');
      });

      if (status === 'lost') {
        // COHORT LOGIC: Always use creation date for Lost deals
        dealDate = createdDate;
      } else if (status === 'won') {
        if (explicitDateField && explicitDateField.value) {
          // HIGHEST PRIORITY: Manual Date Field
          // Handles "YYYY-MM-DD" or ISO
          dealDate = explicitDateField.value.split("T")[0];
        } else {
          // ACCRUAL LOGIC: Use finish date for Won deals.

          // SPECIAL CASE: "Enviado ao Cliente" is an active phase (no finished_at).
          // User Request (2025-01-20): "são cards ATUALIZADOS nessa data e não criados"
          // We must use updated_at to capture when they entered this phase/were modified.
          const currentPhaseName = normalize(card.current_phase?.name || '');
          dealDate = card.finished_at || card.updated_at || createdDate;
        }
      } else {
        // ACTIVE LOGIC: Use last update or creation for in-progress deals
        dealDate = card.finished_at || card.updated_at || createdDate;
      }

      // 4. Loss Reason Mapping (Robust Multi-Try)
      let lossReason = null;
      if (status === 'lost') {
        const fields = card.fields;

        // Strategy A: Configured Field
        if (config.lossReasonField) {
          const match = fields.find(f => normalize(f.name).includes(normalize(config.lossReasonField)));
          if (match) lossReason = match.value;
        }

        // Strategy B: Common Fallbacks (if A failed)
        if (!lossReason) {
          const FALLBACKS = ['motivo da perda', 'motivo de perda', 'motivo recusa', 'motivo do descarte', 'loss reason', 'motivo'];
          const match = fields.find(f => {
            const name = normalize(f.name);
            return FALLBACKS.some(fb => name.includes(fb));
          });
          if (match) lossReason = match.value;
        }

        if (!lossReason) {
          lossReason = 'Outros';
          // DEBUG: Sample one failure to help user debug
          if (Math.random() < 0.01) { // 1% sample to avoid spam
            console.warn(`[Pipefy] Could not find Loss Reason for Lost Card "${card.title}". Available Fields:`, fields.map(f => f.name));
          }
        }
      }

      // 5. Channel Mapping
      let channel = 'Outros';
      if (card.labels && card.labels.length > 0) {
        channel = card.labels[0].name;
      } else {
        channel = 'Pipefy (Sem Tag)';
      }

      // DEBUG: Log specific decision logic for Apolar/Andar debugging
      if (status === 'new' && (normPhaseName.includes('ganho') || normPhaseName.includes('assinado') || normPhaseName.includes('perdido'))) {
        console.warn(`[Pipefy Debug] Card ${card.title} (Phase: ${phaseName}) mapped to NEW but phase suggests WON/LOST. Check Config!`);
      }

      // 6. UTM Mapping (Marketing Data)
      let utm_campaign = null;
      let utm_content = null;
      let utm_term = null;
      let utm_source = null;
      let utm_medium = null;

      if (card.fields && card.fields.length > 0) {
        card.fields.forEach(f => {
          if (!f.value) return; // Skip empty fields to prevent overwriting valid data

          const n = normalize(f.name);

          // "Campanha" -> utm_campaign
          if (n === 'utm_campaign' || n === 'campaign' || n === 'campanha' || n.includes('campaign')) {
            if (!utm_campaign || n === 'utm_campaign') utm_campaign = f.value;
          }

          // "Conteúdo" -> utm_content
          else if (n === 'utm_content' || n === 'content' || n === 'conteudo' || n.includes('content') || n.includes('criativo') || n.includes('anuncio') || n.includes('creative') || n.includes('identificacao')) {
            if (!utm_content || n === 'utm_content') utm_content = f.value;
          }

          // "Termo" / "Público" -> utm_term
          else if (n === 'utm_term' || n === 'term' || n === 'termo' || n.includes('term') || n.includes('publico')) {
            if (!utm_term || n === 'utm_term') utm_term = f.value;
          }

          // "Fonte" -> utm_source
          else if (n === 'utm_source' || n === 'source' || n === 'fonte' || n.includes('source') || n.includes('origem')) {
            if (!utm_source || n === 'utm_source') utm_source = f.value;
          }

          // "Meio" -> utm_medium
          else if (n === 'utm_medium' || n === 'medium' || n === 'meio' || n.includes('medium')) {
            if (!utm_medium || n === 'utm_medium') utm_medium = f.value;
          }
        });
      }

      return {
        id: card.id,
        companyId: orgId, // USE DYNAMIC ID
        title: card.title,
        date: dealDate,
        createdAt: createdDate,
        daysToClose: (() => {
          if (!dealDate || !createdDate) return 0;
          const start = new Date(createdDate).getTime();
          const end = new Date(dealDate).getTime();
          // Ensure no negative (e.g. if dealDate is before created because of timezone or manual set)
          return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
        })(),
        amount: amount,
        items: 1,
        channel: channel,
        labels: card.labels ? card.labels.map(l => l.name) : [], // CRITICAL FIX: Preserve all labels
        seller: card.assignees[0]?.name || 'SDR',
        client: card.title,
        status: status,
        lossReason: lossReason,
        wonDate: card.finished_at,
        phaseId: phaseId,
        phaseName: card.current_phase?.name,
        // UTMs
        utm_campaign,
        utm_content,
        utm_term,
        utm_source,
        utm_medium,
        // Insurance Type (Andar)
        insuranceType: (() => {
          if (!card.fields) return null;

          // STRICT FIX: Prioritize "QUAL O TIPO DE SEGURO?"
          // User explicitly requested to IGNORE "Tipo de seguro:" (which usually contains internal IDs like 'seguro_condominio')
          // and use "Qual o tipo de seguro?" (which contains 'Condominial').

          const typeField = card.fields.find(f => {
            const n = normalize(f.name);
            // Must contain "qual" to distinguish from the generic/internal field
            return n.includes('qual o tipo de seguro') || n === 'produto';
          });

          if (!typeField || !typeField.value) return null;

          // CLEANING LOGIC: Remove ["..."] artifacts if present
          let val = typeField.value;
          if (typeof val === 'string') {
            // Check if it looks like a JSON array or has quotes
            if (val.startsWith('[') || val.includes('"')) {
              // Try explicit replace of [" "] first as it's the common case
              val = val.replace(/[\[\]"]/g, '').trim();
            }
          }
          return val;
        })()
      };
    }); // End of map

    // DEBUG SUMMARY
    const summary = {
      total: allEdges.length,
      filtered: mappedDeals.length,
      won: mappedDeals.filter(d => d.status === 'won').length,
      phasesFound: phases.length
    };
    console.log(`[Pipefy Debug] Fetch Complete. Raw: ${allEdges.length}, Active(Depth Limit): ${mappedDeals.length}, Won: ${summary.won}`);
    console.log('[Pipefy Debug] Sample Deal:', mappedDeals[0]);

    return {
      deals: mappedDeals,
      debug: {
        phasesFound: phases.length,
        totalRaw: allEdges.length,
        filteredCount: mappedDeals.length
      }
    };

  } catch (error) {
    console.error('Pipefy Query:', queryFields); // Log the query to see if it's malformed
    throw error; // Propagate error to AdminSettings
  }
}

/**
 * Fetch Pipe Structure (Phases and Fields) for Configuration Dropdowns
 */
export async function getPipeDetails(pipeId, token) {
  if (!token || !pipeId) throw new Error('Token e Pipe ID são obrigatórios.');

  const query = `
    {
      pipe(id: ${pipeId}) {
        phases { id name }
        start_form_fields { id label }
        labels { id name }
      }
    }
  `;

  try {
    const res = await fetch(PIPEFY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query })
    });

    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);

    if (!json.data || !json.data.pipe) {
      throw new Error(`Pipe com ID ${pipeId} não encontrado ou acesso negado.`);
    }

    return {
      phases: json.data.pipe.phases || [],
      fields: json.data.pipe.start_form_fields || [],
      labels: json.data.pipe.labels || []
    };
  } catch (error) {
    console.error("Error fetching pipe details:", error);
    throw error;
  }
}
