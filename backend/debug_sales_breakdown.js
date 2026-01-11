
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const WON_PHASE_ID = "338889923";

async function analyzeSales() {
    console.log(`\n\n=== ANALYZING "WON" CARDS FOR DEC 2025 (FULL SCAN) ===`);

    let allCards = [];
    let hasNext = true;
    let cursor = null;

    while (hasNext) {
        // Fetch Phase Cards
        const query = `
        {
            phase(id: ${WON_PHASE_ID}) {
                cards(first: 50, after: ${cursor ? `"${cursor}"` : null}) {
                    edges {
                        node {
                            id
                            title
                            finished_at
                            updated_at
                            createdAt
                            created_at
                            current_phase { name }
                        }
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }`;

        try {
            const res = await fetch('https://api.pipefy.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                body: JSON.stringify({ query })
            });

            const json = await res.json();
            if (!json.data?.phase?.cards) break;

            const data = json.data.phase.cards;
            if (data.edges) {
                allCards.push(...data.edges.map(e => e.node));
            }

            hasNext = data.pageInfo.hasNextPage;
            cursor = data.pageInfo.endCursor;

        } catch (e) {
            console.error("Error fetching page:", e);
            break;
        }
    }

    console.log(`Phase contains ${allCards.length} cards total.`);

    let decCount = 0;

    console.log("\n--- Cards detected as 'Sold in Dec' by Logic (Finished OR Updated in Dec) ---");

    allCards.forEach((c, idx) => {
        const created = new Date(c.createdAt || c.created_at);
        const finished = c.finished_at ? new Date(c.finished_at) : null;
        const updated = new Date(c.updated_at);

        // My Logic: dealDate = finished || updated
        const dealDate = finished || updated;

        if (dealDate.getFullYear() === 2025 && dealDate.getMonth() === 11) {
            decCount++;
            const isCohort = (created.getFullYear() === 2025 && created.getMonth() === 11);

            console.log(`[${decCount}] ${c.title}`);
            console.log(`   Created: ${created.toISOString()} (${isCohort ? 'DEC' : 'OLD'})`);
            console.log(`   Finished: ${finished ? finished.toISOString() : 'NULL'}`);
            console.log(`   Updated: ${updated.toISOString()}`);
            console.log(`   Logic Used: ${finished ? 'Finished Date' : 'Updated Date (Fallback)'}`);
            console.log('---');
        }
    });

    console.log(`\nTotal Detected: ${decCount}`);
}

analyzeSales();
