const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// Helper to safely parse BigInt
const toBigInt = (val) => {
    try {
        return BigInt(val);
    } catch (e) {
        return null;
    }
};

/**
 * GET /api/companies/:id/users
 * List users for a company
 */
router.get('/:id/users', async (req, res) => {
    try {
        const { id } = req.params;
        const users = await prisma.companyUser.findMany({
            where: { companyId: toBigInt(id) },
            include: { user: true } // Fetch linked user details if available
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching company users:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/companies
 * List all companies (Global Visibility) with Integration Config
 */
router.get('/', async (req, res) => {
    try {
        const companies = await prisma.company.findMany({
            include: { integrations: true }
        });

        // Convert BigInt to String and Flatten Integrations for Frontend Compatibility
        const safeCompanies = companies.map(c => {
            const company = {
                ...c,
                id: c.id.toString(),
            };

            // Flatten Integrations
            c.integrations.forEach(integration => {
                if (integration.type === 'pipefy') {
                    company.pipefyOrgId = integration.pipefyOrgId;
                    company.pipefyPipeId = integration.pipefyPipeId;
                    company.pipefyToken = integration.pipefyToken;

                    // Parse Advanced Settings
                    if (integration.settings) {
                        try {
                            const settings = JSON.parse(integration.settings);
                            company.wonPhase = settings.wonPhase;
                            company.wonPhaseId = settings.wonPhaseId;
                            company.lostPhase = settings.lostPhase;
                            company.lostPhaseId = settings.lostPhaseId;
                            company.qualifiedPhase = settings.qualifiedPhase;
                            company.qualifiedPhaseId = settings.qualifiedPhaseId;
                            company.valueField = settings.valueField;
                            company.lossReasonField = settings.lossReasonField;
                        } catch (e) {
                            console.error('Error parsing integration settings:', e);
                        }
                    }
                }
                if (integration.type === 'meta_ads') {
                    company.metaAdAccountId = integration.metaAdAccountId;
                    company.metaToken = integration.metaAccessToken; // Note: schema says metaAccessToken, frontend uses metaToken
                }
            });

            // Remove the integrations array from the response to keep it clean for frontend?
            // Actually, keeping it as 'integrations' is better for future, but 
            // the frontend expects flat props for now. I'll send both or just flat.
            // Let's send flat props as verified above.
            return company;
        });

        res.json(safeCompanies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/companies
 * Sync (Create/Update) Company from LocalStorage to DB + Integrations
 */
router.post('/', async (req, res) => {
    try {
        const {
            id, name, cnpj, logo,
            // Pipefy Fields
            pipefyOrgId, pipefyPipeId, pipefyToken,
            // Advanced Mapping
            wonPhase, wonPhaseId,
            lostPhase, lostPhaseId,
            qualifiedPhase, qualifiedPhaseId,
            valueField, lossReasonField,
            // Meta Fields
            metaAdAccountId, metaToken
        } = req.body;

        if (!id || !name) {
            return res.status(400).json({ error: 'ID and Name are required' });
        }

        const companyIdBigInt = toBigInt(id);

        // 1. Upsert Company
        const company = await prisma.company.upsert({
            where: { id: companyIdBigInt },
            update: { name, cnpj, logo },
            create: {
                id: companyIdBigInt,
                name,
                cnpj,
                logo
            }
        });

        // 2. Upsert Pipefy Integration
        if (pipefyPipeId || pipefyToken) {
            // Bundle advanced settings
            const advancedSettings = {
                wonPhase, wonPhaseId,
                lostPhase, lostPhaseId,
                qualifiedPhase, qualifiedPhaseId,
                valueField, lossReasonField
            };

            await prisma.integration.upsert({
                where: {
                    companyId_type: {
                        companyId: companyIdBigInt,
                        type: 'pipefy'
                    }
                },
                update: {
                    pipefyOrgId,
                    pipefyPipeId,
                    pipefyToken,
                    settings: JSON.stringify(advancedSettings),
                    isActive: true
                },
                create: {
                    companyId: companyIdBigInt,
                    type: 'pipefy',
                    pipefyOrgId,
                    pipefyPipeId,
                    pipefyToken,
                    settings: JSON.stringify(advancedSettings),
                    isActive: true
                }
            });
        }

        // 3. Upsert Meta Integration
        if (metaAdAccountId || metaToken) {
            await prisma.integration.upsert({
                where: {
                    companyId_type: {
                        companyId: companyIdBigInt,
                        type: 'meta_ads'
                    }
                },
                update: {
                    metaAdAccountId,
                    metaAccessToken: metaToken, // Map metaToken -> metaAccessToken
                    isActive: true
                },
                create: {
                    companyId: companyIdBigInt,
                    type: 'meta_ads',
                    metaAdAccountId,
                    metaAccessToken: metaToken,
                    isActive: true
                }
            });
        }

        res.json(company);
    } catch (error) {
        console.error('Error syncing company:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/companies/:id/users
 * Add a user to a company
 */
router.post('/:id/users', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ error: 'Email and role are required' });
        }

        // Check if user exists in our User table (by email) to link them
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        // Upsert CompanyUser
        const companyUser = await prisma.companyUser.upsert({
            where: {
                companyId_email: {
                    companyId: toBigInt(id),
                    email: email
                }
            },
            update: {
                role,
                userId: existingUser ? existingUser.id : undefined
            },
            create: {
                companyId: toBigInt(id),
                email,
                role,
                userId: existingUser ? existingUser.id : undefined
            }
        });

        // Trigger Invite Email (Simulated)
        // Ideally we call the logic from invite.js here or let frontend call it.
        // For simplicity, let's keep the invite endpoint separate or integrate it here.
        // Re-using the logic from invite.js would be cleaner, but for now let's just return success.

        res.json(companyUser);
    } catch (error) {
        console.error('Error adding company user:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/companies/:id/users/:email
 * Remove a user from a company
 */
router.delete('/:id/users/:email', async (req, res) => {
    try {
        const { id, email } = req.params;

        await prisma.companyUser.delete({
            where: {
                companyId_email: {
                    companyId: toBigInt(id),
                    email: email
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        // If not found, just return success
        if (error.code === 'P2025') {
            return res.json({ success: true });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a company and all its data
 * DELETE /api/companies/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Due to onDelete: Cascade in schema.prisma, this will also delete
        // metrics, integrations, and sync logs.
        await prisma.company.delete({
            where: { id: toBigInt(id) }
        });

        res.json({ success: true, message: 'Empresa e todos os dados relacionados foram excluídos.' });
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
