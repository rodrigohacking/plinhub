const express = require('express');
const router = express.Router();
const syncService = require('../services/sync.service');
const supabase = require('../utils/supabase');
const { handleSyncRequest } = require('../controllers/metaAdsSync.controller');
const { handlePipefySyncRequest } = require('../controllers/pipefySync.controller');

/**
 * Force manual sync for a company
 * POST /api/sync/:companyId/force
 */
router.post('/:companyId/force', async (req, res) => {
    try {
        const { companyId } = req.params;

        let company;
        if (company) {
            // Already have company
        } else {
            // Try searching by name if ID search failed or logic isn't appropriate for UUID
            // Actually, Supabase .eq('id', uuid) works. 
            // We can just try to find by ID first.
            const { data } = await supabase.from('Company').select('*').eq('id', companyId).single();
            if (data) company = data;
        }

        if (!company) {
            const { data } = await supabase.from('Company')
                .select('*')
                .or(`name.ilike.%${companyId}%,name.ilike.%${decodeURIComponent(companyId)}%`)
                .limit(1)
                .single();
            company = data;
        }

        if (!company) {
            return res.status(404).json({ error: `Empresa '${companyId}' não encontrada para sincronização.` });
        }

        const results = await syncService.syncCompanyMetrics(company.id);

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Incremental Meta Ads sync — bulk UPSERT via new controller
 * POST /api/sync/:companyId/meta?days=7
 */
router.post('/:companyId/meta', handleSyncRequest);

/**
 * Pipefy historical sync — fetch all cards and UPSERT into sales table
 * POST /api/sync/:companyId/pipefy
 */
router.post('/:companyId/pipefy', handlePipefySyncRequest);

/**
 * Get sync logs for a company
 * GET /api/sync/:companyId/logs
 */
router.get('/:companyId/logs', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { limit = 50 } = req.query;

        const { data: logs, error } = await supabase
            .from('SyncLog')
            .select('*')
            .eq('companyId', companyId)
            .order('createdAt', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw new Error(error.message);

        res.json(logs || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


/**
 * Daily Sync Endpoint (For Vercel Cron)
 * GET /api/sync/daily
 * Secured by CRON_SECRET
 */
router.get('/daily', async (req, res) => {
    try {
        // Security Check
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET;

        // Vercel automatically sends this header
        // Allow if CRON_SECRET matches OR if running locally (dev)
        const isAuthorized = (authHeader === `Bearer ${cronSecret}`) ||
            (process.env.NODE_ENV === 'development' && !cronSecret);

        if (!isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized: Cron Secret Required' });
        }

        console.log('🔄 Starting daily sync job (via HTTP)...');
        const startTime = Date.now();

        // Step 1: Find active integrations
        const { data: activeIntegrations, error: intError } = await supabase
            .from('Integration')
            .select('companyId')
            .eq('isActive', true);

        if (intError) throw new Error(intError.message);

        const companyIds = [...new Set(activeIntegrations.map(i => i.companyId))];

        if (companyIds.length === 0) {
            console.log("No companies with active integrations found.");
            return res.json({ success: true, message: "No active companies found", count: 0 });
        }

        // Step 2: Fetch companies
        const { data: companies, error: compError } = await supabase
            .from('Company')
            .select('id, name')
            .in('id', companyIds);

        if (compError) throw new Error(compError.message);

        console.log(`Found ${companies.length} companies to sync`);

        // Step 3: Trigger Sync (Promise All or Sequential? Sequential is safer for rate limits)
        const results = [];
        for (const company of companies) {
            try {
                console.log(`Syncing company: ${company.name} (ID: ${company.id})`);
                await syncService.syncCompanyMetrics(company.id);
                results.push({ company: company.name, status: 'success' });
            } catch (error) {
                console.error(`Failed to sync company ${company.id}:`, error);
                results.push({ company: company.name, status: 'error', error: error.message });
            }
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Daily sync completed in ${duration}ms`);

        res.json({
            success: true,
            duration,
            results
        });

    } catch (error) {
        console.error('❌ Daily sync failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
