const cron = require('node-cron');
const supabase = require('../utils/supabase'); // Changed from prisma
const syncService = require('../services/sync.service');

/**
 * Daily sync cron job
 * Runs every day at 6 AM
 */
function startCronJobs() {
    const schedule = process.env.SYNC_SCHEDULE || '0 6 * * *';

    cron.schedule(schedule, async () => {
        console.log('🔄 Starting daily sync job...');
        const startTime = Date.now();

        try {
            // Get all companies with active integrations
            // Step 1: Find active integrations to get company IDs
            const { data: activeIntegrations, error: intError } = await supabase
                .from('Integration')
                .select('companyId')
                .eq('isActive', true);

            if (intError) throw new Error(intError.message);

            const companyIds = [...new Set(activeIntegrations.map(i => i.companyId))];

            if (companyIds.length === 0) {
                console.log("No companies with active integrations found.");
                return;
            }

            // Step 2: Fetch companies
            const { data: companies, error: compError } = await supabase
                .from('Company')
                .select('id, name')
                .in('id', companyIds);

            if (compError) throw new Error(compError.message);

            console.log(`Found ${companies.length} companies to sync`);

            // Sync each company
            for (const company of companies) {
                try {
                    console.log(`Syncing company: ${company.name} (ID: ${company.id})`);
                    await syncService.syncCompanyMetrics(company.id);
                } catch (error) {
                    console.error(`Failed to sync company ${company.id}:`, error);
                }
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Daily sync completed in ${duration}ms`);
        } catch (error) {
            console.error('❌ Daily sync failed:', error);
        }
    });

    console.log(`📅 Cron job scheduled: ${schedule}`);
}

module.exports = { startCronJobs };
