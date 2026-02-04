require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkSchema() {
    console.log("🕵️‍♀️ Checking Company Schema...");

    // Try to select * from one row to see keys
    const { data, error } = await supabase
        .from('Company')
        .select('*')
        .limit(1);

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Available Columns:", Object.keys(data[0]));
    } else {
        console.log("No data found to infer schema.");
    }
}

checkSchema();
