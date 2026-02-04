require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkGoalsTable() {
    console.log("🕵️‍♀️ Checking for 'goals' table...");

    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .limit(1);

    if (error) {
        console.error("❌ Error checking table:", error.message);
        if (error.code === '42P01') {
            console.log("ℹ️ Table 'goals' likely does not exist.");
        }
    } else {
        console.log("✅ Table 'goals' exists.");
        if (data.length > 0) {
            console.log("   Sample Keys:", Object.keys(data[0]));
        } else {
            console.log("   (Table is empty but exists)");
        }
    }
}

checkGoalsTable();
