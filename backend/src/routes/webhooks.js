const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const pipefyService = require('../services/pipefy.service');

/**
 * Pipefy Webhook Receiver
 * POST /api/webhooks/pipefy
 */
router.post('/pipefy', async (req, res) => {
    try {
        const payload = req.body;
        console.log('[Webhook] Receive Pipefy Event:', payload.action || 'unknown');

        const card = payload.data?.card;
        const pipeId = card?.pipe?.id;

        if (!pipeId) {
            return res.status(400).json({ error: 'Missing pipe ID in payload' });
        }

        // 1. Find the company/integration for this pipe
        const { data: integration, error: intError } = await supabase
            .from('Integration')
            .select('companyId')
            .eq('pipefyPipeId', pipeId.toString())
            .eq('isActive', true)
            .single();

        if (intError || !integration) {
            console.warn(`[Webhook] No active integration found for pipe ${pipeId}`);
            return res.status(200).json({ status: 'ignored', reason: 'no_integration' });
        }

        const companyId = integration.companyId;

        // Incremental sync for only 7 days to ensure performance (vs 10k cards pull)
        const syncService = require('../services/sync.service');
        await syncService.processPipefyWebhookCard(companyId, card);

        res.json({ success: true, companyId });
    } catch (error) {
        console.error('[Webhook] Error processing Pipefy event:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
