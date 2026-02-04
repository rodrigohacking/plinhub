require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function listTables() {
    console.log("🕵️‍♀️ Listing Tables...");

    // Note: Supabase JS doesn't have an easy "list tables" without SQL.
    // I will try to infer by checking common names.
    const candidates = ['Integration', 'CompanyIntegration', 'MetaIntegration', 'account_integrations'];

    for (const table of candidates) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`✅ Table Found: ${table}`);
            if (data.length > 0) console.log("   Keys:", Object.keys(data[0]));
        } else {
            // console.log(`❌ ${table}: ${error.message}`);
        }
    }
}

listTables();
