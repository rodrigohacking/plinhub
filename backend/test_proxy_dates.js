const axios = require('axios');

async function testProxyDates() {
    console.log("🧪 Testing Pipefy Card Dates...");

    const PIPE_ID = '306438109'; // Andar
    const TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';

    // Query specifically for dates
    const query = `
    {
      pipe(id: ${PIPE_ID}) {
        phases {
            name
            cards(first: 5) {
                edges {
                    node {
                        id
                        title
                        created_at
                        finished_at
                        updated_at
                    }
                }
            }
        }
      }
    }`;

    try {
        const res = await axios.post('http://localhost:3001/api/pipefy', {
            query: query
        }, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.data.data && res.data.data.pipe) {
            console.log("✅ Pipefy Data Received. Analyzing Dates for Jan 2026...");
            const phases = res.data.data.pipe.phases;
            let jan2026Count = 0;
            let totalCards = 0;

            phases.forEach(phase => {
                const cards = phase.cards.edges.map(e => e.node);
                if (cards.length > 0) {
                    console.log(`\nPhase: ${phase.name}`);
                    cards.forEach(c => {
                        totalCards++;
                        const created = new Date(c.created_at);
                        const isJan2026 = created.getFullYear() === 2026 && created.getMonth() === 0; // 0 = Jan
                        console.log(`   - ${c.title}: Created ${c.created_at} (${isJan2026 ? '✅ JAN 2026' : '❌ OLD'})`);
                        if (isJan2026) jan2026Count++;
                    });
                }
            });

            console.log(`\n📊 Summary:`);
            console.log(`   Total Sample Cards: ${totalCards}`);
            console.log(`   Jan 2026 Cards: ${jan2026Count}`);

            if (jan2026Count === 0) {
                console.warn("⚠️ NO CARDS from Jan 2026 found in this sample! Dashboard 'This Month' will be empty.");
            }

        } else {
            console.error("❌ Invalid Response:", JSON.stringify(res.data, null, 2));
        }

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
    }
}

testProxyDates();
