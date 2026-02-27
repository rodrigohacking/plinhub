/**
 * PipefySync Controller
 * ---------------------
 * Fetches all cards from a Pipefy pipe and UPSERTs them into the Supabase `sales` table.
 * This enables historical backfill and ongoing sync without frontend API calls.
 *
 * Flow:
 *   1. Resolve Integration (pipefyPipeId + pipefyToken) for the company
 *   2. Call PipefyService.getPipeCards() to get ALL cards
 *   3. Map each card to a `sales` row (status derived from phase name)
 *   4. Bulk UPSERT on pipefy_card_id — idempotent, safe to re-run
 */

const pipefyService = require('../services/pipefy.service');
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');

// Phase-to-status mapping (customizable per company via Integration.settings)
const DEFAULT_WON_PHASES = [
    'contrato assinado', 'ganho', 'fechado', 'fechada',
    'apolice emitida', 'apolice fechada', 'enviado ao cliente',
    'fechamento - ganho'
];

const DEFAULT_LOST_PHASES = [
    'perdido', 'cancelado', 'descarte', 'recusado', 'invalido'
];

const DEFAULT_QUALIFIED_PHASES = [
    'cotação', 'em contato', 'qualificado', 'proposta enviada',
    'contratação'
];

/**
 * Derive deal status from Pipefy phase name
 */
function deriveStatus(phaseName, phaseId, settings = {}) {
    const norm = (phaseName || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const wonPhases = (settings.wonPhases || DEFAULT_WON_PHASES).map(p => p.toLowerCase());
    const lostPhases = (settings.lostPhases || DEFAULT_LOST_PHASES).map(p => p.toLowerCase());
    const qualifiedPhases = (settings.qualifiedPhases || DEFAULT_QUALIFIED_PHASES).map(p => p.toLowerCase());

    // Check won phase IDs first
    if (settings.wonPhaseIds && settings.wonPhaseIds.includes(String(phaseId))) return 'won';
    if (settings.lostPhaseIds && settings.lostPhaseIds.includes(String(phaseId))) return 'lost';

    if (wonPhases.some(w => norm.includes(w))) return 'won';
    if (lostPhases.some(l => norm.includes(l))) return 'lost';
    if (qualifiedPhases.some(q => norm.includes(q))) return 'qualified';

    return 'new';
}

/**
 * Extract a numeric value from a card field by checking multiple candidate names
 */
function extractFieldValue(fields, fieldNames) {
    if (!fields || !fieldNames) return null;
    const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

    for (const name of names) {
        const field = fields.find(f => f.name && f.name.toLowerCase().includes(name.toLowerCase()));
        if (field && field.value) {
            // Robust parsing for Brazilian format (1.234,56)
            // 1. Remove all dots (thousand separators)
            // 2. Replace comma with dot (decimal separator)
            const cleanValue = field.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
            const num = parseFloat(cleanValue);
            if (!isNaN(num)) return num;
        }
    }
    return null;
}

/**
 * Normalize date strings (Replace spaces with T if needed for ISO compatibility)
 */
function normalizeDate(dateStr) {
    if (!dateStr) return null;
    return dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
}

/**
 * Map a Pipefy card to the `sales` table schema
 */
function toSalesRow(companyId, card, settings = {}) {
    const phaseName = card.current_phase?.name || '';
    const phaseId = card.current_phase?.id || '';
    const status = deriveStatus(phaseName, phaseId, settings);
    const labels = (card.labels || []).map(l => l.name || l);

    // USER REQUEST: Selective Sync
    // Only include cards with marketing-related labels for the dashboard marketing context.
    // If no marketing labels, we return null to filter it out in the sync loop.
    const isMarketingLead = labels.some(l => {
        const norm = l.toUpperCase();
        return norm.includes('META ADS') || norm.includes('GOOGLE ADS') || 
               norm.includes('FACEBOOK') || norm.includes('INSTAGRAM') || 
               norm.includes('ANUNCIO') || norm.includes('TRAFEGO');
    });

    if (!isMarketingLead && !settings.includeAllCards) {
        return null;
    }

    // Extract amount from the configured value field (or try common money fields)
    const valueFieldName = settings.valueField || 'Valor';
    // Priorities based on audit: Final Value > Estimate > Default
    const moneyFields = [
        'Valor final do prêmio',        // Andar Won
        'Valor mensal dos honorários',  // Apolar
        'Valor de Prêmio',              // Andar Estimate
        'Valor mensal :',               // Apolar Alt
        valueFieldName,
        'Montante',
        'Preço'
    ];
    const amount = extractFieldValue(card.fields, moneyFields);

    // Won date: use finished_at if status is won, otherwise null
    const wonDate = status === 'won' && card.finished_at ? card.finished_at : null;

    // Extract seller (Dono do Card/Vendedor)
    let seller = null;
    
    // 1. Priority: Assigned Users (Pipefy Assignees)
    if (card.assignees && card.assignees.length > 0) {
        seller = card.assignees.map(a => a.name).join(', ');
    } 
    
    // 2. Secondary: Search in custom fields (Wide search)
    if (!seller) {
        const sellerFieldNames = [
            settings.sellerField || 'Responsável',
            'Vendedor',
            'Consultor',
            'Gestor do Card',
            'Responsável pelo Card',
            'Dono do Card'
        ];
        seller = extractRawFieldValue(card.fields, sellerFieldNames);
    }

    // 3. Fallback: Created By (Person who started the deal)
    if (!seller && card.created_by && card.created_by.name) {
        seller = card.created_by.name;
    }

    // Clean seller string if it's a stringified JSON array like '["Name"]'
    if (typeof seller === 'string' && (seller.startsWith('[') || seller.includes('"'))) {
        try {
            const parsed = JSON.parse(seller);
            seller = Array.isArray(parsed) ? parsed.join(', ') : seller;
        } catch (e) {
            // Manual cleanup if JSON.parse fails
            seller = seller.replace(/[\[\]"]/g, '').trim();
        }
    }

    // Extract loss reason if lost
    const lossReasonField = settings.lossReasonField || 'Motivo';
    const lossReasonText = status === 'lost'
        ? card.fields?.find(f => f.name && f.name.toLowerCase().includes(lossReasonField.toLowerCase()))?.value || null
        : null;

    // Extract won date if available
    const rawWonDate = extractRawFieldValue(card.fields, [
        'Data de fechamento da Apólice', 
        'Data de fechamento', 
        'Data de Onboarding',
        'Data de Pagamento'
    ]);
    
    let finalWonDate = null;
    if (rawWonDate && typeof rawWonDate === 'string') {
        const cleanDate = rawWonDate.trim();
        // Handle Brazilian format DD/MM/YYYY
        if (cleanDate.includes('/')) {
            const parts = cleanDate.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                // Ensure they are numbers and have correct length
                if (!isNaN(parseInt(d)) && !isNaN(parseInt(m)) && !isNaN(parseInt(y)) && y.length === 4) {
                    try {
                        finalWonDate = new Date(`${y}-${m}-${d}T12:00:00Z`).toISOString();
                    } catch (e) {
                        console.error("Date construction error:", e);
                    }
                }
            }
        }
        
        // Final fallback if parsing failed but we have a string
        if (!finalWonDate && !isNaN(Date.parse(cleanDate))) {
            finalWonDate = new Date(cleanDate).toISOString();
        }
    }

    // Extract product/insurance type
    const productFieldNames = [
        'Tipo de seguro',
        'Qual o tipo de Seguro',
        'Qual o tipo de seguro?',
        'Tipo de Lead',
        'Tipo de Negócio'
    ];
    let productRaw = extractRawFieldValue(card.fields, productFieldNames);
    
    // Clean array-like strings if present (e.g. [["Condominial"]])
    let product = productRaw;
    if (typeof productRaw === 'string' && productRaw.startsWith('[[')) {
        try {
            const parsed = JSON.parse(productRaw);
            product = Array.isArray(parsed) && Array.isArray(parsed[0]) ? parsed[0][0] : productRaw;
        } catch (e) {
            product = productRaw.replace(/[\[\]"]/g, '');
        }
    }

    let channelLabel = 'Orgânico';
    if (labels.length > 0) {
        // Priority: Marketing-specific labels if they exist
        const marketingLabel = labels.find(l => {
            const n = l.toUpperCase();
            return n.includes('META') || n.includes('ADS') || n.includes('GOOGLE') || n.includes('TRAFEGO');
        });
        
        // If no specific marketing label, use the first available label (e.g. Partner names)
        channelLabel = marketingLabel || labels[0];
    }

    return {
        company_id: companyId,
        pipefy_card_id: String(card.id),
        client: card.title,
        status,
        amount: amount || 0,
        date: card.created_at ? new Date(card.created_at).toISOString() : new Date().toISOString(),
        created_at_pipefy: normalizeDate(card.created_at),
        won_date: finalWonDate || (status === 'won' && card.finished_at ? normalizeDate(card.finished_at) : null),
        product: product || null,
        phase_name: phaseName,
        phase_id: String(phaseId),
        labels: JSON.stringify(labels),
        channel: channelLabel,
        seller: seller || null,
        loss_reason: lossReasonText,
        updated_at: new Date().toISOString()
    };
}

// Add helper to extract raw field value without parsing as number
function extractRawFieldValue(fields, fieldNames) {
    if (!fields || !fieldNames) return null;
    const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
    for (const name of names) {
        const field = fields.find(f => f.name && f.name.toLowerCase().includes(name.toLowerCase()));
        if (field && field.value) return field.value;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Core sync function
// ---------------------------------------------------------------------------

async function syncPipefyDeals(companyId, pipeId, token, settings = {}) {
    console.log(`[PipefySync] Fetching cards for company ${companyId}, pipe ${pipeId}...`);

    const { pipe, cards } = await pipefyService.getPipeCards(pipeId, token);

    if (!cards || cards.length === 0) {
        console.log('[PipefySync] No cards returned.');
        return { success: true, rowsUpserted: 0 };
    }

    console.log(`[PipefySync] ${cards.length} cards fetched. Mapping and filtering marketing leads...`);

    const salesRows = cards
        .map(card => toSalesRow(companyId, card, settings))
        .filter(row => row !== null);

    console.log(`[PipefySync] Filtered down to ${salesRows.length} marketing-relevant cards.`);

    // Bulk UPSERT in batches of 500 (Supabase limit)
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < salesRows.length; i += BATCH_SIZE) {
        const batch = salesRows.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
            .from('sales')
            .upsert(batch, {
                onConflict: 'pipefy_card_id',
                ignoreDuplicates: false
            });

        if (error) {
            console.error(`[PipefySync] Upsert batch error:`, error.message);
            throw new Error(`Supabase upsert failed: ${error.message}`);
        }

        totalUpserted += batch.length;
    }

    console.log(`[PipefySync] Done — ${totalUpserted} sales rows upserted.`);
    return { success: true, rowsUpserted: totalUpserted };
}

// ---------------------------------------------------------------------------
// Express route handler
// ---------------------------------------------------------------------------

async function handlePipefySyncRequest(req, res) {
    const { companyId } = req.params;

    try {
        // Resolve Pipefy integration
        const { data: integration, error: intError } = await supabase
            .from('Integration')
            .select('pipefyPipeId, pipefyToken, settings')
            .eq('companyId', companyId)
            .eq('type', 'pipefy')
            .eq('isActive', true)
            .single();

        if (intError || !integration) {
            return res.status(404).json({
                success: false,
                error: 'No active Pipefy integration found for this company.'
            });
        }

        if (!integration.pipefyToken || !integration.pipefyPipeId) {
            return res.status(400).json({
                success: false,
                error: 'Pipefy token or pipe ID not configured.'
            });
        }

        // Decrypt token (decrypt function handles plain text safely)
        let token;
        try {
            token = decrypt(integration.pipefyToken);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Failed to decrypt Pipefy token.'
            });
        }

        // Parse settings (phase mapping, value field, etc.)
        let settings = {};
        if (integration.settings) {
            try {
                settings = typeof integration.settings === 'string'
                    ? JSON.parse(integration.settings)
                    : integration.settings;
            } catch (e) {
                console.warn('[PipefySync] Failed to parse settings:', e);
            }
        }

        const result = await syncPipefyDeals(
            companyId,
            integration.pipefyPipeId,
            token,
            settings
        );

        // Update lastSync
        await supabase
            .from('Integration')
            .update({ lastSync: new Date().toISOString() })
            .eq('companyId', companyId)
            .eq('type', 'pipefy');

        return res.json(result);

    } catch (error) {
        console.error(`[PipefySync] Error for company ${companyId}:`, error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    syncPipefyDeals,
    handlePipefySyncRequest
};
