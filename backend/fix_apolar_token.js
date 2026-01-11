
require('dotenv').config(); // Load ENV for ENCRYPTION_KEY
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { encrypt } = require('./src/utils/encryption');
const syncService = require('./src/services/sync.service');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const COMPANY_ID = 2; // Apolar

async function fixAndSync() {
    console.log("Fixing token for Apolar...");

    const encryptedToken = encrypt(TOKEN);

    // Update Integration
    // Find the integration for company 2 first
    const integration = await prisma.integration.findFirst({
        where: { companyId: COMPANY_ID, type: 'pipefy' }
    });

    if (!integration) {
        console.error("Integration not found!");
        return;
    }

    await prisma.integration.update({
        where: { id: integration.id },
        data: { pipefyToken: encryptedToken }
    });
    console.log("Token updated and encrypted.");

    // Trigger Sync
    console.log("Triggering Sync...");
    try {
        const result = await syncService.syncCompanyMetrics(COMPANY_ID);
        console.log("Sync Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Sync Failed:", e.message);
    }
}

fixAndSync()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
