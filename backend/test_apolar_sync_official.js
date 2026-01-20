require('dotenv').config();
const syncService = require('./src/services/sync.service');

async function testApolarSync() {
    try {
        console.log('Testing Apolar sync with new filtering...\n');

        const result = await syncService.syncCompanyMetrics('Apolar');

        console.log('\nSync result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testApolarSync();
