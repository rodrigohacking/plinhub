const axios = require('axios');

async function testCompanies() {
    console.log("🧪 Testing Local Companies API (http://localhost:3001/api/companies)...");

    try {
        const res = await axios.get('http://localhost:3001/api/companies');

        console.log("✅ Companies Response Status:", res.status);
        if (Array.isArray(res.data)) {
            console.log(`✅ Fetched ${res.data.length} companies.`);
            res.data.forEach(c => {
                console.log(`\n🏢 Company: ${c.name} (${c.id})`);
                console.log(`   - Pipefy Token Present: ${!!c.pipefyToken}`);
                console.log(`   - Pipefy ID: ${c.pipefyPipeId}`);
                console.log(`   - Meta Token Present: ${!!c.metaToken}`);
                // Debug raw integration if needed
                // console.log("   - Raw:", JSON.stringify(c, null, 2)); 
            });
        } else {
            console.error("❌ Invalid Response Format (Not Array):", res.data);
        }

    } catch (error) {
        console.error("❌ Companies API Test Failed!");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}

testCompanies();
