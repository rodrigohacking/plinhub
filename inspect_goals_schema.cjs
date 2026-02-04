const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const supabase = require('./backend/src/utils/supabase');

async function inspectSchema() {
    console.log("🕵️‍♀️ Inspecting 'goals' table columns...");

    // Can't easily query information_schema via supabase-js standard client unless we use rpc or raw query if enable
    // But we can try to select specific columns and fail.

    // Better: Try to SELECT keys from information schema via SQL function if available, or just guess.
    // Actually, Supabase client `rpc` can execute SQL if a function exists.

    // Let's try to infer from error message 
    // OR we can just try to insert dummy data with 'company_id' and see if it works?

    // Let's try checking if `company_id` exists.
    const { data, error } = await supabase
        .from('goals')
        .select('company_id')
        .limit(1);

    if (error) {
        console.log("❌ 'company_id' SELECT failed:", error.message);
    } else {
        console.log("✅ 'company_id' column exists!");
    }

    const { data: data2, error: error2 } = await supabase
        .from('goals')
        .select('companyId')
        .limit(1);

    if (error2) {
        console.log("❌ 'companyId' SELECT failed:", error2.message);
    } else {
        console.log("✅ 'companyId' column exists!");
    }

    // Also check 'month', 'revenue', 'deals', 'leads', 'sdrGoals'
    const cols = ['month', 'revenue', 'deals', 'leads', 'sdr_goals', 'sdrGoals'];
    for (const col of cols) {
        const { error: e } = await supabase.from('goals').select(col).limit(1);
        if (e) console.log(`❌ '${col}' failed: ${e.message}`);
        else console.log(`✅ '${col}' exists!`);
    }

}

inspectSchema();
