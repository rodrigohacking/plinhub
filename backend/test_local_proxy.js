const axios = require('axios');

async function testProxy() {
    console.log("🧪 Testing Local Backend Proxy (http://localhost:3001/api/pipefy)...");

    const PIPE_ID = '306438109'; // Andar
    const TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';

    const query = `{ pipe(id: ${PIPE_ID}) { phases { id name cards_count } } }`;

    try {
        const res = await axios.post('http://localhost:3001/api/pipefy', {
            query: query
        }, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Proxy Response Status:", res.status);
        if (res.data.data && res.data.data.pipe) {
            console.log("✅ Pipefy Data Received!");
            console.log("   Phases found:", res.data.data.pipe.phases.length);
            res.data.data.pipe.phases.slice(0, 3).forEach(p => console.log(`   - ${p.name}: ${p.cards_count} cards`));
        } else {
            console.error("❌ Invalid Response Structure:", JSON.stringify(res.data, null, 2));
        }

    } catch (error) {
        console.error("❌ Proxy Test Failed!");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.error("⛔ Connection Refused! Is the backend server running on port 3001?");
        } else {
            console.error("Error:", error.message);
        }
    }
}

testProxy();
