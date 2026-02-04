const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { decrypt } = require('../utils/encryption');

// Initialize Supabase Service Client (Bypasses RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // Fallback to Anon if Service missing (won't bypass RLS but connects)

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("CRITICAL: Missing Supabase Environment Variables in Backend!");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * GET /api/companies
 * List all companies (Global Visibility) with Integration Config
 */
router.get('/', async (req, res) => {
    try {
        console.log("Backend: Fetching companies via Supabase Service Role...");

        // Fetch Company AND its Integrations (Raw Supabase Query)
        const { data: companies, error } = await supabase
            .from('Company')
            .select('*, Integration(*)');

        if (error) {
            console.error('Supabase Service Error:', error);
            throw error;
        }

        // Flatten Integrations for Frontend Compatibility
        const safeCompanies = (companies || []).map(c => {
            const company = {
                ...c,
                // Ensure ID is string (UUID is already string, but just in case)
                id: c.id.toString(),
            };

            // Flatten Integrations
            if (c.Integration && Array.isArray(c.Integration)) {
                c.Integration.forEach(integration => {
                    if (integration.type === 'pipefy') {
                        company.pipefyOrgId = integration.pipefyOrgId;
                        company.pipefyPipeId = integration.pipefyPipeId;
                        // Decrypt Token if present
                        if (integration.pipefyToken) {
                            try {
                                company.pipefyToken = integration.pipefyToken.includes(':')
                                    ? decrypt(integration.pipefyToken)
                                    : integration.pipefyToken; // Fallback if regular string
                            } catch (e) {
                                console.warn(`Failed to decrypt Pipefy token for company ${c.id}`);
                                company.pipefyToken = null;
                            }
                        }

                        // Parse JSON settings and merge (Flatten)
                        if (integration.settings) {
                            try {
                                const settings = typeof integration.settings === 'string'
                                    ? JSON.parse(integration.settings)
                                    : integration.settings;
                                Object.assign(company, settings);
                            } catch (e) {
                                console.warn(`Error parsing settings for company ${c.id}:`, e);
                            }
                        }
                    }
                    if (integration.type === 'meta_ads') {
                        company.metaAdAccountId = integration.metaAdAccountId;
                        // Decrypt Meta Token too if needed by frontend
                        if (integration.metaAccessToken) {
                            try {
                                company.metaToken = integration.metaAccessToken.includes(':')
                                    ? decrypt(integration.metaAccessToken)
                                    : integration.metaAccessToken;
                            } catch (e) {
                                // Silent fail usually ok, frontend rarely uses raw meta token anymore
                            }
                        }
                    }
                });
            }
            return company;
        });

        console.log(`Backend: Successfully fetched ${safeCompanies.length} companies.`);
        res.json(safeCompanies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({
            error: error.message,
            hint: "Check server logs. Verify SUPABASE_SERVICE_ROLE_KEY is set."
        });
    }
});

/**
 * POST /api/companies
 * Create a new company
 */
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const { data, error } = await supabase
            .from('Company')
            .upsert({ name }, { onConflict: 'name' })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/companies/:id
 * Update an existing company
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const { data, error } = await supabase
            .from('Company')
            .update({ name })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Company not found' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/companies/:id
 * Delete a company
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('Company')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
