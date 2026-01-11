const cron = require('node-cron');
const prisma = require('../utils/prisma');
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
            const companies = await prisma.company.findMany({
                where: {
                    integrations: {
                        some: {
                            isActive: true
                        }
                    }
                },
                select: {
                    id: true,
                    name: true
                }
            });

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
