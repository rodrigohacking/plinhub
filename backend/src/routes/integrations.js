const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
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

        const integrations = await prisma.integration.findMany({
            where: { companyId: parseInt(companyId) },
            select: {
                id: true,
                type: true,
                isActive: true,
                lastSync: true,
                // Pipefy
                pipefyOrgId: true,
                pipefyPipeId: true,
                // Meta Ads (without token)
                metaAdAccountId: true,
                metaAccountName: true,
                metaStatus: true,
                metaTokenExpiry: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json(integrations);
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
        const { pipefyOrgId, pipefyPipeId, pipefyToken } = req.body;

        const integration = await prisma.integration.upsert({
            where: {
                companyId_type: {
                    companyId: parseInt(companyId),
                    type: 'pipefy'
                }
            },
            update: {
                pipefyOrgId,
                pipefyPipeId,
                pipefyToken: encrypt(pipefyToken),
                isActive: true
            },
            create: {
                companyId: parseInt(companyId),
                type: 'pipefy',
                pipefyOrgId,
                pipefyPipeId,
                pipefyToken: encrypt(pipefyToken),
                isActive: true
            }
        });

        res.json({ success: true, integration });
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

        const integration = await prisma.integration.findUnique({
            where: {
                companyId_type: {
                    companyId: parseInt(companyId),
                    type: 'meta_ads'
                }
            }
        });

        if (!integration || !integration.metaAccessToken) {
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

        await prisma.integration.delete({
            where: {
                companyId_type: {
                    companyId: parseInt(companyId),
                    type
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
