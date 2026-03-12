const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const pipefyService = require('../services/pipefy.service');
const { decrypt } = require('../utils/encryption');
const { toSalesRow, syncPipefyDeals } = require('../controllers/pipefySync.controller');

/**
 * Pipefy Webhook Receiver
 * POST /api/webhooks/pipefy
 *
 * Receives card events from Pipefy and upserts the single card directly into
 * the `sales` table — no full resync needed. Instantaneous updates.
 */
router.post('/pipefy', async (req, res) => {
    // Acknowledge immediately so Pipefy doesn't retry
    res.json({ received: true });

    try {
        const payload = req.body;
        const action = payload.action || 'unknown';
        console.log(`[Webhook] Pipefy event: ${action}`);

        const cardId = payload.data?.card?.id;
        const pipeId = payload.data?.card?.pipe?.id || payload.data?.pipe?.id;

        if (!cardId || !pipeId) {
            console.warn('[Webhook] Missing cardId or pipeId in payload');
            return;
        }

        // Find integration for this pipe
        const { data: integration } = await supabase
            .from('Integration')
            .select('companyId, pipefyToken, pipefyPipeId, settings')
            .eq('pipefyPipeId', pipeId.toString())
            .eq('isActive', true)
            .single();

        if (!integration) {
            console.warn(`[Webhook] No active integration for pipe ${pipeId}`);
            return;
        }

        const companyId = integration.companyId;

        // Decrypt token
        let token;
        try {
            token = decrypt(integration.pipefyToken);
        } catch (e) {
            console.error('[Webhook] Failed to decrypt Pipefy token:', e.message);
            return;
        }

        // Parse integration settings
        let settings = {};
        if (integration.settings) {
            try {
                settings = typeof integration.settings === 'string'
                    ? JSON.parse(integration.settings)
                    : integration.settings;
            } catch (e) { /* ignore */ }
        }

        // Fetch full card data from Pipefy (single API call)
        const card = await pipefyService.getCardById(cardId, token);
        if (!card) {
            console.warn(`[Webhook] Card ${cardId} not found in Pipefy`);
            return;
        }

        // Map to sales row and upsert
        const salesRow = toSalesRow(companyId, card, settings);
        if (!salesRow) {
            console.log(`[Webhook] Card ${cardId} filtered out (not a marketing lead)`);
            return;
        }

        const { error } = await supabase
            .from('sales')
            .upsert(salesRow, { onConflict: 'pipefy_card_id', ignoreDuplicates: false });

        if (error) {
            console.error(`[Webhook] Upsert failed for card ${cardId}:`, error.message);
        } else {
            console.log(`[Webhook] Card ${cardId} upserted to sales (${salesRow.status})`);
        }

    } catch (error) {
        console.error('[Webhook] Error processing Pipefy event:', error.message);
    }
});

module.exports = router;
