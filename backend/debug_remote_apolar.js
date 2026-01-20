const path = require('path');
// Load backend .env (priority) AND root .env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const key = process.env.ENCRYPTION_KEY;
console.log(`ENCRYPTION_KEY Status: ${key ? 'Present' : 'Missing'} (${key ? key.length : 0} chars)`);

const supabase = require('./src/utils/supabase');
const syncService = require('./src/services/sync.service');

async function debugApolar() {
    console.log("🔍 Triggering Apolar Sync...");

    const apolarId = '5b936bf7-39ab-4f19-b636-818d6281dbd8';

    try {
        console.log(`🚀 Starting Sync for ${apolarId}...`);
        const result = await syncService.syncCompanyMetrics(apolarId);
        console.log("✅ Sync Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Sync Failed:", error);
    }
}

debugApolar();
