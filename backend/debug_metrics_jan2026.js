const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function checkMetrics() {
    console.log("📊 Checking Metric Table Data...");

    // 1. Total Count
    const { count, error: countErr } = await supabase
        .from('Metric')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error("❌ Error counting metrics:", countErr.message);
        return;
    }
    console.log(`✅ Total Metric Rows: ${count}`);

    // 2. Check for January 2026
    const startMonth = '2026-01-01';
    const endMonth = '2026-01-31';

    const { data: janData, error: janErr } = await supabase
        .from('Metric')
        .select('*')
        .gte('date', startMonth)
        .lte('date', endMonth);

    if (janErr) {
        console.error("❌ Error fetching Jan 2026 data:", janErr.message);
    } else {
        console.log(`📅 Jan 2026 Rows: ${janData.length}`);
        if (janData.length > 0) {
            console.log("   Sample (first 2):", janData.slice(0, 2).map(m => ({
                id: m.id,
                companyId: m.companyId,
                date: m.date,
                source: m.source
            })));
        } else {
            console.warn("⚠️ No data for January 2026! Dashboard will be empty if filtered by 'Current Month'.");
        }
    }

    // 3. Check most recent date
    const { data: latest, error: lastErr } = await supabase
        .from('Metric')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

    if (latest && latest.length > 0) {
        console.log(`🗓️ Most Recent Data Date: ${latest[0].date}`);
    }
}

checkMetrics();
