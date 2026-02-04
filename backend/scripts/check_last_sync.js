require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkLastSync() {
    console.log("Checking Last Sync Timestamps...");

    const { data: integrations, error } = await supabase
        .from('Integration')
        .select(`
            id,
            type,
            lastSync,
            Company ( name )
        `)
        .eq('isActive', true)
        .order('lastSync', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.table(integrations.map(i => ({
        Company: i.Company?.name,
        Type: i.type,
        LastSync: i.lastSync ? new Date(i.lastSync).toLocaleString() : 'NEVER'
    })));
}

checkLastSync();
