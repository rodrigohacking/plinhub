const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function checkDates() {
    console.log("📅 Checking Metric Dates for Apolar...");

    // Apolar ID (from previous steps)
    const COMPANY_ID = '5b936bf7-39ab-4f19-b636-818d6281dbd8';

    const { data: metrics, error } = await supabase
        .from('Metric')
        .select('date, createdAt, value, status')
        .eq('companyId', COMPANY_ID)
        .order('date', { ascending: false })
        .limit(10);

    if (error) {
        console.error("❌ Error fetching metrics:", error.message);
        return;
    }

    if (metrics.length === 0) {
        console.log("⚠️ No metrics found for Apolar.");
    } else {
        console.log(`✅ Found ${metrics.length} recent metrics (showing top 10):`);
        metrics.forEach(m => {
            console.log(`   - Date: ${m.date} | CreatedAt: ${m.createdAt} | Status: ${m.status} | Amount: ${m.amount}`);
        });
    }
}

checkDates();
