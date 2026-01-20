require('dotenv').config({ path: '.env' });
const supabase = require('./src/utils/supabase');
const syncService = require('./src/services/sync.service');

async function verifySync() {
    try {
        console.log("Finding company 'Andar Seguros'...");
        const { data: company, error } = await supabase
            .from('Company')
            .select('*')
            .ilike('name', '%Andar Seguros%')
            .single();

        if (error || !company) {
            console.error("Company not found:", error);
            return;
        }

        console.log(`Found company: ${company.name} (${company.id})`);

        // Check Integration Config
        const { data: integrations } = await supabase
            .from('Integration')
            .select('*')
            .eq('companyId', company.id)
            .eq('type', 'meta_ads');

        if (integrations && integrations.length > 0) {
            console.log("Meta Integration Config:", {
                ...integrations[0],
                metaAccessToken: '***'
            });
        } else {
            console.log("No Meta Integration found!");
        }

        // Trigger Sync
        console.log("Triggering Sync...");
        const result = await syncService.syncCompanyMetrics(company.id);
        console.log("Sync Result:", result);

        // Verify Campaigns
        console.log("Verifying 'campaigns' table...");
        const { data: campaigns, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('company_id', company.id)
            .order('start_date', { ascending: false })
            .limit(20);

        if (campError) {
            console.error("Error fetching campaigns:", campError);
        } else {
            console.log(`Found ${campaigns.length} recent campaign records.`);
            campaigns.forEach(c => {
                console.log(`- [${c.start_date}] ${c.name} (ID: ${c.campaign_id})`);
                console.log(`  Invest: R$${c.investment} | Leads: ${c.leads}`);
            });
        }

    } catch (e) {
        console.error("Verification failed:", e);
    }
}

verifySync();
