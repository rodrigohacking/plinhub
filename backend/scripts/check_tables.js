require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkDailyInsights() {
    console.log("🕵️‍♀️ Checking 'DailyInsight' (or similar) table...");

    // First, list all tables (if possible via Supabase API usually not, so we guess)
    // We'll try selecting from 'DailyInsight' and 'daily_insights'

    try {
        const { data, error } = await supabase.from('daily_insights').select('*').limit(1);
        if (!error) {
            console.log("✅ Table 'daily_insights' found!");
            console.log("Sample:", data[0]);
            return;
        } else {
            console.log("❌ 'daily_insights' not found or error:", error.code);
        }
    } catch (e) { }

    try {
        const { data, error } = await supabase.from('DailyInsight').select('*').limit(1);
        if (!error) {
            console.log("✅ Table 'DailyInsight' found!");
            console.log("Sample:", data[0]);
            return;
        } else {
            console.log("❌ 'DailyInsight' not found or error:", error.code);
        }
    } catch (e) { }
}

checkDailyInsights();
