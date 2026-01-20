const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function debugSchema() {
    console.log("🔍 Introspecting Supabase Schema...");

    // List all tables in public schema
    // PostgreSQL query via RPC or directly if we have permission.
    // Client SDK doesn't list tables easily.
    // But we can try to select from expected tables to see errors.

    const tables = ['Company', 'Integration', 'users', 'Metric', 'Metrics', 'SyncLog', 'sync_logs'];

    for (const table of tables) {
        console.log(`\nChecking table: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Error: ${error.message} (${error.code})`);
        } else {
            console.log(`✅ Exists. Sample:`, data && data.length > 0 ? Object.keys(data[0]) : 'Empty');
        }
    }
}

debugSchema();
