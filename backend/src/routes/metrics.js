const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

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
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const where = {
            companyId: parseInt(companyId),
            date: {
                gte: startDate,
                lte: endDate
            }
        };

        if (source) {
            where.source = source;
        }

        const metrics = await prisma.metric.findMany({
            where,
            orderBy: { date: 'desc' }
        });

        res.json(metrics);
    } catch (error) {
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
        let { companyId } = req.params;

        // ... (company lookup remains the same) ...
        let company;
        let numericId = parseInt(companyId);

        if (!isNaN(numericId)) {
            company = await prisma.company.findUnique({ where: { id: numericId } });
        }

        if (!company) {
            // Try searching by name if ID fails
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
            return res.status(404).json({ error: `Empresa '${companyId}' não encontrada. Verifique se o ID ou Nome estão corretos.` });
        }

        const effectiveId = company.id;

        let startDate = new Date();
        let endDate = new Date();

        if (range.includes('d')) {
            const days = parseInt(range.replace('d', ''));
            startDate.setDate(startDate.getDate() - days);
        } else if (range.startsWith('custom:')) {
            const parts = range.split(':');
            if (parts.length === 3) {
                startDate = new Date(parts[1]);
                endDate = new Date(parts[2]);
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            const now = new Date();
            switch (range) {
                case 'this-month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'last-month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;
                case 'last-3-months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    break;
                case 'last-6-months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                    break;
                case 'this-year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 30);
            }
        }

        // Get Meta Ads metrics (filter by tag if relevant)
        const metaMetrics = await prisma.metric.findMany({
            where: {
                companyId: effectiveId,
                source: 'meta_ads',
                label: tag,
                date: { gte: startDate, lte: endDate }
            },
            orderBy: { date: 'desc' }
        });

        // Get Pipefy metrics (filter by tag)
        const pipefyMetrics = await prisma.metric.findMany({
            where: {
                companyId: effectiveId,
                source: 'pipefy',
                label: tag,
                date: { gte: startDate, lte: endDate }
            },
            orderBy: { date: 'desc' }
        });

        // Get available tags for this company to help frontend
        const uniqueLabels = await prisma.metric.findMany({
            where: { companyId: effectiveId, source: 'pipefy' },
            select: { label: true },
            distinct: ['label']
        });
        const availableTags = uniqueLabels.map(l => l.label).filter(l => l !== 'all');

        // Aggregate totals
        const metaTotal = metaMetrics.reduce((acc, m) => ({
            spend: acc.spend + (m.spend || 0),
            impressions: acc.impressions + (m.impressions || 0),
            clicks: acc.clicks + (m.clicks || 0),
            conversions: acc.conversions + (m.conversions || 0)
        }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

        // Aggregate totals for the period
        const pipefyTotal = pipefyMetrics.reduce((acc, m) => ({
            leadsEntered: acc.leadsEntered + (m.cardsCreated || 0),
            leadsQualified: acc.leadsQualified + (m.cardsQualified || 0),
            salesClosed: acc.salesClosed + (m.cardsConverted || 0),
            leadsLost: acc.leadsLost + (m.cardsLost || 0)
        }), { leadsEntered: 0, leadsQualified: 0, salesClosed: 0, leadsLost: 0 });

        // Get lifetime totals from the latest sync record (which contains cardsByPhase)
        const latestMetric = pipefyMetrics[0] || await prisma.metric.findFirst({
            where: { companyId: effectiveId, source: 'pipefy', label: tag },
            orderBy: { date: 'desc' }
        });

        let lifetimePipefy = null;
        if (latestMetric && latestMetric.cardsByPhase) {
            try {
                const phases = JSON.parse(latestMetric.cardsByPhase);
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
                total: metaTotal,
                daily: metaMetrics
            },
            pipefy: {
                total: pipefyTotal,
                lifetime: lifetimePipefy,
                summary: pipefySummary,
                daily: pipefyMetrics
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
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
