require('dotenv').config();
const syncService = require('./src/services/sync.service');

async function syncApolar() {
    try {
        console.log('Running sync for Apolar Condomínios...\n');

        // Use company name to find it
        const result = await syncService.syncCompanyMetrics('Apolar');

        console.log('\nSync completed!');
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Sync error:', error.message);
        console.error('Stack:', error.stack);
    }
}

syncApolar();
