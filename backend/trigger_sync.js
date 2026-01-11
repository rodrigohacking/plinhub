
const syncService = require('./src/services/sync.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function triggerSync() {
    const companyId = 1; // Andar
    console.log(`Starting sync for Company ${companyId}...`);

    try {
        const result = await syncService.syncCompanyMetrics(companyId);
        console.log("Sync Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Sync Failed:", e.message);
        if (e.stack) console.error(e.stack);
    } finally {
        await prisma.$disconnect();
    }
}

triggerSync();
