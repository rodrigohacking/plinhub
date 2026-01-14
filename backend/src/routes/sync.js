const express = require('express');
const router = express.Router();
const syncService = require('../services/sync.service');
const supabase = require('../utils/supabase'); // Changed from prisma

/**
 * Force manual sync for a company
 * POST /api/sync/:companyId/force
 */
router.post('/:companyId/force', async (req, res) => {
    try {
        const { companyId } = req.params;

        let company;
        let numericId = parseInt(companyId);

        if (!isNaN(numericId)) {
            const { data } = await supabase.from('Company').select('*').eq('id', numericId).single();
            company = data;
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
            .eq('companyId', parseInt(companyId))
            .order('createdAt', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw new Error(error.message);

        res.json(logs || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
