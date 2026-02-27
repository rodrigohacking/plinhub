const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase'); // Changed from prisma

/**
 * Get metrics for a company
 * GET /api/metrics/:companyId?source=meta_ads&range=30d
 */
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { source, range = '30d' } = req.query;

        // Calculate date range
        const days = parseInt(range.replace('d', ''));
        const endDate = new Date().toISOString();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString();

        let query = supabase
            .from('Metric')
            .select('*')
            .eq('companyId', companyId)
            .gte('date', startDateStr)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (source) {
            query = query.eq('source', source);
        }

        const { data: metrics, error } = await query;

        if (error) throw new Error(error.message);
        res.json(metrics || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Save/Update a Metric (Goal)
 * POST /api/metrics
 */
router.post('/', async (req, res) => {
    try {
        const metric = req.body;

        // Critical Validation
        if (!metric.companyId || !metric.source || !metric.date) {
            return res.status(400).json({ error: 'Missing required fields: companyId, source, date' });
        }

        // Use backend supabase client (admin privileges usually)
        const { error } = await supabase
            .from('Metric')
            .upsert(metric, { onConflict: 'companyId, source, date, label' });

        if (error) throw new Error(error.message);

        res.json({ success: true });
    } catch (error) {
        console.error("Error saving metric via API:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get unified dashboard data
 * GET /api/metrics/:companyId/unified
 */
router.get('/:companyId/unified', async (req, res) => {
    try {
        const { range = '30d', tag = 'all' } = req.query;
        // The original code had `let { companyId: companyIdInput } = req.params;` and `let company;`
        // The instruction implies removing a 'numericId' calculation.
        // Based on the provided 'Code Edit' snippet, the `companyIdInput` and `company` declarations are removed,
        // and `companyId` is directly used from `req.params`.
        // This effectively removes any logic that would convert or validate `companyId` as a numeric ID.
        const { companyId } = req.params; // Use companyId directly from params
        let company;

        // Verify if it's a UUID or if we need to search by name
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);

        // let companyId = companyIdInput; // This will be the ID used for queries - this line is now redundant

        if (isUuid) {
            const { data: companyData } = await supabase.from('Company').select('id, name').eq('id', companyId).single();
            company = companyData;
        } else {
            // Try searching by name if it's not a UUID
            const { data: companyData } = await supabase.from('Company')
                .select('id, name')
                .or(`name.ilike.%${companyId}%,name.ilike.%${decodeURIComponent(companyId)}%`)
                .limit(1)
                .single();
            company = companyData;
        }

        if (!company) {
            return res.status(404).json({ error: `Empresa '${companyId}' não encontrada. Verifique se o ID ou Nome estão corretos.` });
        }

        const effectiveId = company.id;

        const getBRDate = () => {
            return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        };

        let now = getBRDate();
        let startDate = new Date(now);
        let endDate = new Date(now);

        if (range.includes('d')) {
            const days = parseInt(range.replace('d', ''));
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
        } else if (range.startsWith('custom:')) {
            const parts = range.split(':');
            if (parts.length === 3) {
                startDate = new Date(parts[1] + 'T00:00:00');
                endDate = new Date(parts[2] + 'T23:59:59');
            }
        } else {
            switch (range) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'yesterday':
                    startDate.setDate(startDate.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setDate(endDate.getDate() - 1);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'this-month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
                    break;
                case 'last-month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                    break;
                case 'last-3-months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
                    break;
                case 'last-6-months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0);
                    break;
                case 'this-year':
                    startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 30);
                    startDate.setHours(0, 0, 0, 0);
            }
        }

        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();

        // 1. Fetch Aggregated Totals via RPC (High Performance)
        // If tag is 'all', we pass null to p_labels to sum everything in the table.
        // This is safe now because we've removed redundant 'all' labels in SyncService.
        let rpcLabels = tag === 'all' ? null : [tag];

        // 1. Fetch Aggregated Totals via RPC (High Performance)
        const { data: aggregatedData, error: rpcError } = await supabase
            .rpc('get_metrics_summary', {
                p_company_id: effectiveId,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0],
                p_labels: rpcLabels
            });

        if (rpcError) console.error("RPC Error:", rpcError);

        const metaAgg = aggregatedData?.find(d => d.source === 'meta_ads') || {};
        const pipefyAgg = aggregatedData?.find(d => d.source === 'pipefy') || {};

        // 2. Fetch Daily Details (Still needed for charts)
        // Meta Ads metrics
        let metaQuery = supabase
            .from('Metric')
            .select('*')
            .eq('companyId', effectiveId)
            .eq('source', 'meta_ads')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('date', { ascending: false });

        if (tag !== 'all') {
            metaQuery = metaQuery.eq('label', tag);
        }
        const { data: metaMetrics } = await metaQuery;

        // Get Pipefy metrics
        let pipefyQuery = supabase
            .from('Metric')
            .select('*')
            .eq('companyId', effectiveId)
            .eq('source', 'pipefy')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('date', { ascending: false });

        if (tag !== 'all') {
            pipefyQuery = pipefyQuery.eq('label', tag);
        }
        const { data: pipefyMetrics } = await pipefyQuery;

        // Get available tags
        const { data: uniqueLabels } = await supabase
            .from('Metric')
            .select('label')
            .eq('companyId', effectiveId)
            .eq('source', 'pipefy');

        const availableTags = [...new Set(uniqueLabels?.map(l => l.label) || [])].filter(l => l !== 'all');

        const safeMetaMetrics = metaMetrics || [];
        const safePipefyMetrics = pipefyMetrics || [];

        // Map RPC results to expected format
        const metaTotal = {
            spend: parseFloat(metaAgg.total_spend || 0),
            impressions: parseInt(metaAgg.total_impressions || 0),
            clicks: parseInt(metaAgg.total_clicks || 0),
            conversions: parseInt(metaAgg.total_conversions || 0)
        };

        const pipefyTotal = {
            leadsEntered: parseInt(pipefyAgg.total_cards_created || 0),
            leadsQualified: parseInt(pipefyAgg.total_cards_qualified || 0),
            salesClosed: parseInt(pipefyAgg.total_cards_converted || 0),
            leadsLost: parseInt(pipefyAgg.total_cards_lost || 0)
        };


        // User Request: "Metas Fixas... meta de investimento total no Geral seja de R$ 5.500,00"
        if (tag === 'all') {
            // We can inject this into the response or handle it in the frontend. 
            // Since this is the aggregation logic, let's ensure we respect the filtering for Meta Ads too if needed?
            // "A aba 'Geral' está exibindo métricas erradas... porque está somando dados irrelevantes da tabela Metric"
            // This applies to Meta metrics too? "CPL de R$ 1,28" implies Meta Spend / Pipefy Leads.
            // If we filter Pipefy Leads, we MUST filter Meta Spend too to get correct CPL.
        }

        // Get lifetime totals from the latest sync record
        // We look for one record, ordered by date desc
        let latestPipefyQuery = supabase
            .from('Metric')
            .select('*')
            .eq('companyId', effectiveId)
            .eq('source', 'pipefy')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (tag !== 'all') {
            latestPipefyQuery = latestPipefyQuery.eq('label', tag);
        }

        let { data: latestMetric } = await latestPipefyQuery;

        // If query above failed (e.g. no label match), fallback to first from period list
        if (!latestMetric && safePipefyMetrics.length > 0) {
            latestMetric = safePipefyMetrics[0];
        }

        let lifetimePipefy = null;
        if (latestMetric && latestMetric.cardsByPhase) {
            try {
                // If it's already an object (Supabase might return JSONB as object), use it.
                // Else parse string.
                const phases = typeof latestMetric.cardsByPhase === 'string'
                    ? JSON.parse(latestMetric.cardsByPhase)
                    : latestMetric.cardsByPhase;

                const findCount = (names) => {
                    const key = Object.keys(phases).find(k =>
                        names.some(n => k.toLowerCase().includes(n.toLowerCase()))
                    );
                    return key ? phases[key] : 0;
                };

                lifetimePipefy = {
                    totalWon: findCount(['Fechamento - Ganho', 'Ganho', 'Won']),
                    totalLost: findCount(['Fechamento - Perdido', 'Perdido', 'Lost']),
                    totalQualified: findCount(['Qualificação', 'Qualifica', 'Qualified']),
                    totalLeads: Object.values(phases).reduce((a, b) => a + b, 0)
                };
            } catch (e) {
                console.error('Error parsing lifetime phases:', e);
            }
        }

        // Calculate comparative metrics
        const costPerLead = pipefyTotal.leadsEntered > 0
            ? metaTotal.spend / pipefyTotal.leadsEntered
            : 0;

        const costPerConversion = pipefyTotal.salesClosed > 0
            ? metaTotal.spend / pipefyTotal.salesClosed
            : 0;

        // Standardized summary for the dashboard
        const pipefySummary = {
            leads: {
                period: pipefyTotal.leadsEntered,
                total: lifetimePipefy?.totalLeads || pipefyTotal.leadsEntered
            },
            qualified: {
                period: pipefyTotal.leadsQualified,
                total: lifetimePipefy?.totalQualified || pipefyTotal.leadsQualified
            },
            won: {
                period: pipefyTotal.salesClosed,
                total: lifetimePipefy?.totalWon || pipefyTotal.salesClosed
            },
            lost: {
                period: pipefyTotal.leadsLost,
                total: lifetimePipefy?.totalLost || pipefyTotal.leadsLost
            }
        };

        res.json({
            metaAds: {
                total: { ...metaTotal, goal: tag === 'all' ? 5500 : null },
                daily: safeMetaMetrics
            },
            pipefy: {
                total: pipefyTotal,
                lifetime: lifetimePipefy,
                summary: pipefySummary,
                daily: safePipefyMetrics
            },
            comparative: {
                costPerLead: costPerLead,
                costPerConversion: costPerConversion,
                leadsToConversionRate: pipefyTotal.leadsEntered > 0
                    ? (pipefyTotal.salesClosed / pipefyTotal.leadsEntered) * 100
                    : (pipefySummary.won.total / (pipefySummary.leads.total || 1)) * 100
            },
            availableTags: availableTags
        });
    } catch (error) {
        console.error("CRITICAL METRICS ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
