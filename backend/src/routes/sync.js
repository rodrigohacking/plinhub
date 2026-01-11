const express = require('express');
const router = express.Router();
const syncService = require('../services/sync.service');
const prisma = require('../utils/prisma');

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
            company = await prisma.company.findUnique({ where: { id: numericId } });
        }

        if (!company) {
            company = await prisma.company.findFirst({
                where: {
                    OR: [
                        { name: { contains: companyId } },
                        { name: { contains: decodeURIComponent(companyId) } }
                    ]
                }
            });
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

        const logs = await prisma.syncLog.findMany({
            where: { companyId: parseInt(companyId) },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
