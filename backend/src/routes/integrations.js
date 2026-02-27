const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase'); // Changed from prisma
const { encrypt, decrypt } = require('../utils/encryption');
const pipefyService = require('../services/pipefy.service');
const metaAdsService = require('../services/metaAds.service');

/**
 * Get all integrations for a company
 * GET /api/integrations/:companyId
 */
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;

        // Prisma: findMany with select
        // Supabase: select(columns).eq('companyId', id)
        const { data: integrations, error } = await supabase
            .from('Integration')
            .select(`
                id, type, isActive, lastSync,
                pipefyOrgId, pipefyPipeId, settings,
                metaAdAccountId, metaAccountName, metaStatus, metaTokenExpiry,
                createdAt, updatedAt
            `)
            .eq('companyId', companyId);

        if (error) throw new Error(error.message);

        res.json(integrations || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Save Pipefy integration
 * POST /api/integrations/:companyId/pipefy
 */
router.post('/:companyId/pipefy', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { pipefyOrgId, pipefyPipeId, pipefyToken, settings } = req.body;

        // Prisma: upsert
        // Supabase: upsert (requires conflict on unique keys)
        // Note: Assuming 'Integration_companyId_type_key' is the unique constraint. 
        // We'll insert/update based on companyId + type match.

        // First check if exists to get ID (Supabase upsert by default matches ON PRIMARY KEY unless specified)
        // Since we don't have the ID, we query first.
        const { data: existing } = await supabase
            .from('Integration')
            .select('id')
            .eq('companyId', companyId)
            .eq('type', 'pipefy')
            .single();

        const payload = {
            companyId: companyId,
            type: 'pipefy', // Unique key comb
            pipefyOrgId,
            pipefyPipeId,
            // Prevent double encryption: Check if it looks like 'iv:content'
            pipefyToken: (pipefyToken && pipefyToken.includes(':')) ? pipefyToken : encrypt(pipefyToken),
            settings: settings || {}, // Save settings (phases, fields)
            isActive: true,
            updatedAt: new Date()
        };

        if (existing) {
            payload.id = existing.id; // Include ID to trigger update
        }

        const { data: integration, error } = await supabase
            .from('Integration')
            .upsert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);

        res.json({ success: true, integration });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



/**
 * Save Manual Meta Ads integration (Token only)
 * POST /api/integrations/:companyId/meta
 */
router.post('/:companyId/meta', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { metaAdAccountId, metaToken } = req.body;

        const { data: existing } = await supabase
            .from('Integration')
            .select('id')
            .eq('companyId', companyId)
            .eq('type', 'meta_ads')
            .single();

        const payload = {
            companyId: companyId,
            type: 'meta_ads',
            metaAdAccountId,
            metaAccessToken: encrypt(metaToken),
            isActive: true,
            updatedAt: new Date()
        };

        if (existing) {
            payload.id = existing.id;
        }

        const { data, error } = await supabase
            .from('Integration')
            .upsert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);

        res.json({ success: true, integration: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Test Pipefy connection
 * POST /api/integrations/:companyId/pipefy/test
 */
router.post('/:companyId/pipefy/test', async (req, res) => {
    try {
        const { pipefyToken } = req.body;

        const result = await pipefyService.testConnection(pipefyToken);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Test Meta Ads connection
 * POST /api/integrations/:companyId/meta/test
 */
router.post('/:companyId/meta/test', async (req, res) => {
    try {
        const { companyId } = req.params;

        const { data: integration, error } = await supabase
            .from('Integration')
            .select('metaAccessToken')
            .eq('companyId', companyId)
            .eq('type', 'meta_ads')
            .single();

        if (error || !integration || !integration.metaAccessToken) {
            return res.status(404).json({ error: 'Meta Ads integration not found' });
        }

        const accessToken = decrypt(integration.metaAccessToken);
        const result = await metaAdsService.testConnection(accessToken);

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Delete integration
 * DELETE /api/integrations/:companyId/:type
 */
router.delete('/:companyId/:type', async (req, res) => {
    try {
        const { companyId, type } = req.params;

        const { error } = await supabase
            .from('Integration')
            .delete()
            .eq('companyId', companyId)
            .eq('type', type);

        if (error) throw new Error(error.message);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Server-side Pipefy Deals Fetch
 * GET /api/integrations/:companyId/pipefy/deals
 *
 * Instead of the frontend calling the Pipefy GraphQL API directly (which
 * exposes tokens and hits CORS/auth issues), this route uses the encrypted
 * token stored in the Integration table to fetch deals on the server side.
 */
router.get('/:companyId/pipefy/deals', async (req, res) => {
    try {
        const { companyId } = req.params;

        // 1. Get Integration + Company name
        const { data: integration, error: intError } = await supabase
            .from('Integration')
            .select('pipefyOrgId, pipefyPipeId, pipefyToken, settings')
            .eq('companyId', companyId)
            .eq('type', 'pipefy')
            .eq('isActive', true)
            .single();

        if (intError || !integration || !integration.pipefyToken) {
            return res.status(404).json({
                success: false,
                error: 'Integração Pipefy não encontrada ou sem token.',
                deals: []
            });
        }

        const { data: company } = await supabase
            .from('Company')
            .select('name')
            .eq('id', companyId)
            .single();

        // 2. Decrypt token
        const token = decrypt(integration.pipefyToken);
        const pipeId = integration.pipefyPipeId;

        console.log(`[PipefyDeals] Fetching for ${company?.name || companyId} | Pipe: ${pipeId}`);

        // 3. Use getPipeCards to fetch raw card data from Pipefy API
        //    This uses the server-side token and returns { pipe, cards }
        const pipeData = await pipefyService.getPipeCards(pipeId, token);
        const cards = pipeData.cards || [];

        const settings = typeof integration.settings === 'string'
            ? JSON.parse(integration.settings) : (integration.settings || {});

        console.log(`[PipefyDeals] Success! Cards: ${cards.length}`);

        // 4. Return raw cards — the frontend fetchPipefyDeals() handles mapping
        //    We transform to the shape that the frontend expects (edges with node)
        const edgesForFrontend = cards.map(card => ({
            node: card,
            phaseName: card.current_phase?.name || ''
        }));

        res.json({
            success: true,
            deals: edgesForFrontend,
            pipeLabels: pipeData.pipe?.labels || [],
            phases: pipeData.pipe?.phases || [],
            settings,
            fetchedAt: new Date().toISOString()
        });


    } catch (error) {
        console.error('[PipefyDeals] ERROR:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            deals: []
        });
    }
});


/**
 * LIVE FETCH Meta Ads (Real-time data)
 * GET /api/integrations/:companyId/meta/live
 */
router.get('/:companyId/meta/live', async (req, res) => {
    try {
        const { companyId } = req.params;
        // Live Fetch
        const { days = 30, since, until, preset } = req.query; // Accept optional preset

        const { data: integration, error } = await supabase
            .from('Integration')
            .select('metaAccessToken, metaAdAccountId')
            .eq('companyId', companyId)
            .eq('type', 'meta_ads')
            .single();

        if (error || !integration) {
            return res.status(404).json({ error: 'Integração Meta Ads não encontrada.' });
        }

        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = integration.metaAdAccountId;

        // Calculate Date Range
        let startDate, endDate;
        if (since && until) {
            startDate = new Date(since);
            endDate = new Date(until);
        } else {
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
        }

        console.log(`[MetaLive] Fetching for ${companyId} | Range: ${startDate.toISOString()} to ${endDate.toISOString()} | Preset: ${preset}`);

        const insights = await metaAdsService.getCampaignInsights(
            adAccountId,
            accessToken,
            {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                preset: preset // Pass preset explicitly
            },
            [], // filtering
            null // company name
        );

        console.log(`[MetaLive] Success! Fetched ${insights.length} campaigns.`);

        // Return structured data for Frontend
        res.json({
            success: true,
            fetchedAt: new Date(),
            range: { start: startDate, end: endDate },
            data: insights
        });

    } catch (error) {
        console.error('[MetaLive] ERROR:', error.message);
        if (error.response) {
            console.error('[MetaLive] API Response:', error.response.data);
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
