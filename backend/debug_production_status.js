const path = require('path');
// Load backend .env (priority) AND root .env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function checkStatus() {
    console.log("🔍 Checking Production Status...\n");

    // 1. List Companies
    console.log("🏢 Companies:");
    const { data: companies } = await supabase.from('Company').select('id, name, cnpj, created_at').order('created_at');
    companies.forEach(c => {
        console.log(`   - [${c.id}] ${c.name} (CNPJ: ${c.cnpj}) created: ${c.created_at}`);
    });

    // 2. Count Metrics
    console.log("\n📊 Metrics Count:");
    const { count: metricCount, error: mErr } = await supabase.from('Metric').select('*', { count: 'exact', head: true });
    if (mErr) console.error("   ❌ Error counting metrics:", mErr.message);
    else console.log(`   Total Metrics Rows: ${metricCount}`);

    // Break down by Company
    if (metricCount > 0) {
        // We can't do grouping easily with simple client, so just sample
    }

    // 3. Check Integrations
    console.log("\n🔌 Integrations:");
    const { data: integrations } = await supabase.from('Integration').select('id, companyId, type, isActive');
    integrations.forEach(i => {
        const compName = companies.find(c => c.id === i.companyId)?.name || 'Unknown';
        console.log(`   - [${compName}] ${i.type} (Active: ${i.isActive})`);
    });

    // 4. Recent Sync Logs
    console.log("\n📜 Recent Sync Logs (Last 5):");
    const { data: logs } = await supabase.from('SyncLog').select('*').order('createdAt', { ascending: false }).limit(5);
    if (!logs || logs.length === 0) console.log("   (No logs found)");
    else {
        logs.forEach(l => {
            const compName = companies.find(c => c.id === l.companyId)?.name || 'Unknown';
            console.log(`   - [${l.createdAt}] ${compName} (${l.source}): ${l.status} - ${l.message}`);
        });
    }
}

checkStatus();
