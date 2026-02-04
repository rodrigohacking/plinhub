const axios = require('axios');

async function testApi() {
    console.log("Testing API Endpoint...");
    const companyId = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar
    const url = `http://localhost:3001/api/metrics/${companyId}/unified?range=this-month`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        console.log("✅ API Response Status:", response.status);
        console.log("💰 Meta Ads Total Spend:", data.metaAds?.total?.spend);
        console.log("📉 Meta Ads Daily Records:", data.metaAds?.daily?.length);

        if (data.metaAds?.daily?.length > 0) {
            // Show first few records to inspect labels
            console.log("   --- Sample Records ---");
            data.metaAds.daily.slice(0, 3).forEach(r => {
                console.log(`   Label: '${r.label}', Spend: ${r.spend}`);
            });
        }

    } catch (error) {
        console.error("❌ API Error:", error.message);
        if (error.response) {
            console.error("   Status:", error.response.status);
            console.error("   Data:", error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.error("   Connection Refused. Is the server running on port 3001?");
        }
    }
}

testApi();
