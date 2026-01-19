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

module.exports = router;
