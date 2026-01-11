const PIPEFY_API_URL = 'https://api.pipefy.com/graphql';

export async function fetchPipefyDeals(orgId, pipeId, token, config = {}) {
  if (!token || !pipeId) return [];

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
    const SIX_MONTHS_AGO = new Date();
    SIX_MONTHS_AGO.setMonth(SIX_MONTHS_AGO.getMonth() - 6);

    // --- STRATEGY CHANGE: Hybrid Fetch ---
    // 1. Active Phases: Fetch DEEP (all cards) because they are small.
    // 2. Archive Phases (Lost): Do NOT fetch by Phase ID (too big, unstructured).
    // 3. Recent Sweep: Fetch `allCards` (Newest) to catch recent Lost leads that aren't in Active phases.

    console.log(`[Pipefy] Starting HYBRID fetch for pipe ${pipeId}...`);

    // 1. Get All Phases
    const phasesQuery = `{ pipe(id: ${pipeId}) { phases { id name cards_count } } }`;
    const phasesRes = await fetch(PIPEFY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query: phasesQuery })
    });

    // Safety check
    const phasesJson = await phasesRes.json();
    if (phasesJson.errors) {
      console.error('[Pipefy] Error fetching phases:', phasesJson.errors);
      return [];
    }

    const phases = phasesJson.data?.pipe?.phases || [];
    const LOST_PHASE_ID = '338889931'; // Negócio Perdido

    // Filter phases to fetch deeply (Skip Lost)
    const activePhases = phases.filter(p => p.id !== LOST_PHASE_ID);
    console.log(`[Pipefy] Fetching ${activePhases.length} active phases deeply (Skipping Lost phase ${LOST_PHASE_ID})...`);

    // 2. Fetch Cards for Active Phases (Parallel)
    const phasePromises = activePhases.map(async (phase) => {
      let phaseEdges = [];
      let hasNext = true;
      let cursor = null;
      let pagesToCheck = 20; // 1000 cards limit per active phase

      while (hasNext && pagesToCheck > 0) {
        const q = `
            {
                phase(id: ${phase.id}) {
                    cards(first: 50, after: ${cursor ? `"${cursor}"` : null}) {
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
          const json = await res.json();
          const edges = json.data?.phase?.cards?.edges || [];

          if (edges.length === 0) break;

          phaseEdges.push(...edges);

          hasNext = json.data.phase.cards.pageInfo.hasNextPage;
          cursor = json.data.phase.cards.pageInfo.endCursor;
          pagesToCheck--;
        } catch (err) {
          console.error(`[Pipefy] Error fetching phase ${phase.name}:`, err);
          break;
        }
      }
      return phaseEdges;
    });

    // 3. Fetch Recent Cards (Catch-All for Lost Leads)
    // We use 'last: 400' (8 pages * 50) to ensure we cover the 39 lost leads in Dec.
    // 'allCards' with 'last' fetches NEWEST created cards first (usually).
    const recentPromise = (async () => {
      let recentEdges = [];
      let hasPrevious = true;
      let startCursor = null;
      let pages = 8;

      console.log(`[Pipefy] Fetching recent 400 cards (catch-all for Lost)...`);

      while (hasPrevious && pages > 0) {
        const q = `
            {
                allCards(pipeId: ${pipeId}, last: 50, before: ${startCursor ? `"${startCursor}"` : null}) {
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
                    pageInfo { hasNextPage startCursor hasPreviousPage }
                }
            }`;

        try {
          const res = await fetch(PIPEFY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ query: q })
          });
          const json = await res.json();
          const cardsData = json.data?.allCards;
          if (!cardsData || !cardsData.edges) break;

          recentEdges.push(...cardsData.edges);

          hasPrevious = cardsData.pageInfo.hasPreviousPage;
          startCursor = cardsData.pageInfo.startCursor;
          pages--;
        } catch (e) { console.error('[Pipefy] Error fetching recent:', e); break; }
      }
      return recentEdges;
    })();

    // Execute All
    const [activeResults, recentResults] = await Promise.all([
      Promise.all(phasePromises),
      recentPromise
    ]);

    // Merge
    const allFetched = [...activeResults.flat(), ...recentResults];

    // Deduplicate
    const seenIds = new Set();
    allEdges = [];
    allFetched.forEach(e => {
      if (!seenIds.has(e.node.id)) {
        seenIds.add(e.node.id);
        allEdges.push(e);
      }
    });

    console.log(`[Pipefy] Total cards fetched (Hybrid Strategy): ${allEdges.length}`);

    // Map to Dashboard Deal Model
    return allEdges.map(edge => {
      const card = edge.node;

      // 1. Value Mapping
      let valueField = null;

      if (config.valueField) {
        valueField = card.fields.find(f => f.name.toLowerCase() === config.valueField.toLowerCase() || f.name.includes(config.valueField));
      }

      if (!valueField) {
        valueField = card.fields.find(f => {
          const name = f.name.toLowerCase();
          return name.includes('valor') || name.includes('price') || name.includes('receita') || name.includes('mensalidade');
        });
      }

      let amount = 0;
      if (valueField && valueField.value) {
        let v = valueField.value.toString();
        if (v.includes(',') || v.includes('R$')) {
          v = v.replace(/[R$\s]/g, '');
          v = v.replace(/\./g, '');
          v = v.replace(',', '.');
        } else {
          v = v.replace(/[^0-9.]/g, '');
        }
        amount = parseFloat(v) || 0;
      }

      // 2. Status Mapping (STRICT SPEC FROM USER)
      // "Todo card que ESTÁ ou FOI MOVIDO para a fase Negócio Perdido (ID 338889931)"
      let status = 'new';

      const phaseName = (card.current_phase?.name?.toLowerCase() || '').trim();
      const phaseId = String(card.current_phase?.id || '').trim();

      // Normalize phase name for accent-insensitive comparison
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normPhaseName = normalize(phaseName);

      // Configured IDs
      const CFG_LOST_ID = (config.lostPhaseId || '').trim();
      const CFG_WON_ID = (config.wonPhaseId || '').trim();
      const CFG_QUAL_ID = (config.qualifiedPhaseId || '').trim();

      // A. LOST (Priority Logic as per Spec)
      if (phaseId === '338889931' || // Explicit ID from Spec
        (CFG_LOST_ID && phaseId === CFG_LOST_ID) ||
        normPhaseName.includes('perdido') ||
        normPhaseName.includes('negocio perdido') ||
        normPhaseName.includes('lost') ||
        normPhaseName.includes('cancelado')) {
        status = 'lost';
      }


      // B. WON
      if ((CFG_WON_ID && phaseId === CFG_WON_ID) ||
        phaseId === '338889923' || // Fechamento - Ganho
        phaseId === '338889934' || // Apólice Fechada
        normPhaseName.includes('ganho') ||
        normPhaseName.includes('won') ||
        normPhaseName.includes('vendido') ||
        normPhaseName.includes('apolice fechada') ||
        normPhaseName.includes('assinado')) {
        status = 'won';
      }
      // C. QUALIFIED
      else if ((CFG_QUAL_ID && phaseId === CFG_QUAL_ID) ||
        normPhaseName.includes('qualificado') ||
        normPhaseName.includes('potencial') ||
        normPhaseName.includes('negociacao')) {
        status = 'qualified';
      }

      // 3. Date Mapping (STRICT SPEC FROM USER)
      // "Para Leads Perdidos: USAR EXCLUSIVAMENTE a data de criação do card"
      let dealDate;
      const createdDate = card.createdAt || card.created_at;

      if (status === 'lost') {
        // COHORT LOGIC: Always use creation date for Lost deals
        dealDate = createdDate;
      } else if (status === 'won') {
        // ACCRUAL LOGIC: Use finish date for Won deals, fallback to update if not finished (moved to phase but not done)
        dealDate = card.finished_at || card.updated_at || createdDate;
      } else {
        // ACTIVE LOGIC: Use last update or creation
        dealDate = card.finished_at || card.updated_at || createdDate;
      }

      // 4. Loss Reason Mapping
      let lossReason = null;
      if (status === 'lost') {
        if (config.lossReasonField) {
          const reasonField = card.fields.find(f => f.name.toLowerCase().includes(config.lossReasonField.toLowerCase()));
          if (reasonField) lossReason = reasonField.value;
        }
        if (!lossReason) lossReason = 'Outros';
      }

      // 5. Channel Mapping
      let channel = 'Outros';
      if (card.labels && card.labels.length > 0) {
        channel = card.labels[0].name;
      } else {
        channel = 'Pipefy (Sem Tag)';
      }

      return {
        id: card.id,
        companyId: orgId, // USE DYNAMIC ID
        title: card.title,
        date: dealDate,
        createdAt: createdDate,
        daysToClose: 5,
        amount: amount,
        items: 1,
        channel: channel,
        seller: card.assignees[0]?.name || 'SDR',
        client: card.title,
        status: status,
        lossReason: lossReason,
        wonDate: card.finished_at,
        phaseId: phaseId,
        phaseName: card.current_phase?.name
      };
    });

  } catch (error) {
    console.error('Pipefy Fetch Error:', error);
    return [];
  }
}
