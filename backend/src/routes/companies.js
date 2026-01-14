const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

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
                        company.pipefyToken = integration.pipefyToken;
                        // Parse JSON fields if needed
                    }
                    if (integration.type === 'meta_ads') {
                        company.metaAdAccountId = integration.metaAdAccountId;
                        company.metaToken = integration.metaAccessToken;
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

// ... (Other routes like POST/DELETE can remain using Prisma if local, 
// OR should also be migrated. For now, fixing GET is priority for 'Empty State')

module.exports = router;
