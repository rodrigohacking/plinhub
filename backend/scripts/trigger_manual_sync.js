require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');
const syncService = require('../src/services/sync.service');

async function triggerManualSync() {
    console.log("🚀 Starting Manual Sync Trigger...");

    try {
        // 1. Find Apolar Company
        const { data: company, error } = await supabase
            .from('Company')
            .select('id, name')
            .ilike('name', '%Apolar Condomínios%')
            .single();

        if (error || !company) {
            console.error("❌ Apolar Company not found:", error);
            return;
        }

        console.log(`🎯 Target Company: ${company.name} (${company.id})`);

        // 2. Trigger Sync
        console.log("⏳ Syncing metrics (this may take a minute)...");
        const results = await syncService.syncCompanyMetrics(company.id);

        console.log("✅ Sync Completed!");
        console.log("Results:", JSON.stringify(results, null, 2));

    } catch (err) {
        console.error("❌ Sync Failed:", err);
    }
}

triggerManualSync();
