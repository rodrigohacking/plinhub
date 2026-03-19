const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { parseDateRange } = require('../utils/dateRange');

/**
 * Get campaigns for a company
 * GET /api/campaigns/:companyId
 */
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { range = '90d' } = req.query;

        console.log(`Getting campaigns for company ${companyId} (Range: ${range})`);

        // Calculate date range (BRT-correct)
        const { startDate, endDate } = parseDateRange(range);

        // ⚠️ IMPORTANT: start_date is a PostgreSQL `date` column (YYYY-MM-DD), NOT timestamptz.
        // Using .toISOString() gives "2026-03-10T03:00:00.000Z" (BRT midnight in UTC).
        // Postgres would cast the date "2026-03-10" → "2026-03-10T00:00:00Z" to compare,
        // which is LESS THAN "2026-03-10T03:00:00Z", so today's rows get excluded!
        // Solution: use only the YYYY-MM-DD portion for date column comparisons.
        const startDateStr = startDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const endDateStr = endDate ? endDate.toISOString() : undefined; // ISO for proxy (non-date column)

        // Check if companyId is UUID or Name
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);

        let effectiveId = companyId;

        if (!isUuid) {
            const { data: companyData } = await supabase.from('Company')
                .select('id')
                .or(`name.ilike.%${companyId}%,name.ilike.%${decodeURIComponent(companyId)}%`)
                .limit(1)
                .single();

            if (companyData) effectiveId = companyData.id;
            else return res.status(404).json({ error: 'Company not found' });
        }

        // Fetch all campaigns for the company without a start_date lower bound.
        // The live proxy (below) provides dailyInsights for precise filtering; for the
        // cached fallback we return all rows and let the frontend handle date filtering.
        // Capped at 5000 rows to avoid enormous payloads on very active accounts.
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('company_id', effectiveId)
            .gte('start_date', startDateStr) // keep: avoid returning years of stale data
            .order('start_date', { ascending: false })
            .limit(5000);

        if (error) throw new Error(error.message);

        // ATTEMPT LIVE SYNC (PROXY) TO PROVIDE DAILY INSIGHTS FOR ACCURATE FRONTEND DATE FILTERING
        // Only if Integration exists. Fallback to 'campaigns' table.
        try {
            const { data: integration } = await supabase
                .from('Integration')
                .select('id, metaAdAccountId, metaAccessToken, metaStatus, metaTokenExpiry')
                .eq('companyId', effectiveId)
                .eq('type', 'meta_ads')
                .eq('isActive', true)
                .single();

            if (integration && integration.metaAccessToken) {
                const { fetchLiveMetaCampaigns } = require('../utils/metaProxy');
                const liveCampaigns = await fetchLiveMetaCampaigns(integration, startDateStr, endDateStr);
                if (liveCampaigns && liveCampaigns.length > 0) {
                    console.log(`[Campaigns API] Serving ${liveCampaigns.length} LIVE campaigns with daily insights for ${effectiveId}`);
                    // Map company_id to keep compatibility with UI
                    const mappedLive = liveCampaigns.map(c => ({...c, company_id: effectiveId}));
                    return res.json(mappedLive);
                }
            }
        } catch (proxyErr) {
             console.warn(`[Campaigns API] Live Proxy failed: ${proxyErr.message}. Falling back to cached campaigns.`);
        }

        console.log(`[Campaigns API] Serving ${campaigns?.length || 0} CACHED campaigns for ${effectiveId}`);
        res.json(campaigns || []);

    } catch (error) {
        console.error("Error fetching campaigns:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
