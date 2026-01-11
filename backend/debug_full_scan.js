
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function fullScan() {
    console.log(`\n\n=== FULL DEEP SCAN (Dec 2025) ===`);

    // 1. Get Phases
    const phasesQuery = `{ pipe(id: ${PIPE_ID}) { phases { id name cards_count } } }`;
    const phasesRes = await fetch('https://api.pipefy.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ query: phasesQuery })
    });
    const phases = (await phasesRes.json()).data.pipe.phases;

    let totalDecCreated = 0;
    let totalOtherCreated = 0;

    let decStats = {
        won: 0,
        lost: 0,
        qualified: 0,
        other: 0
    };

    console.log(`Scanning ${phases.length} phases...`);

    for (const phase of phases) {
        process.stdout.write(`Scanning Phase: ${phase.name} (${phase.cards_count} cards)... `);

        // Skip huge phases for full detail if we can optimization? 
        // No, we NEED to find the cards.
        // We will fetch ALL cards from smaller phases.
        // For "Negócio Perdido" (1700), we know recent ones are at the end? 
        // We'll try to fetch Newest First for all of them.

        let hasNext = true;
        let cursor = null;
        let phaseDecCount = 0;
        let pCount = 0;

        while (hasNext) {
            const q = `
            {
                phase(id: ${phase.id}) {
                    cards(first: 50, after: ${cursor ? `"${cursor}"` : null}) {
                        edges {
                            node {
                                id
                                title
                                createdAt
                                created_at
                                finished_at
                                updated_at
                            }
                        }
                        pageInfo { hasNextPage endCursor }
                    }
                }
            }`;

            const res = await fetch('https://api.pipefy.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                body: JSON.stringify({ query: q })
            });
            const json = await res.json();
            if (!json.data?.phase?.cards) break;

            const edges = json.data.phase.cards.edges;
            if (edges.length === 0) break;

            edges.forEach(e => {
                const c = e.node;
                const created = new Date(c.createdAt || c.created_at);

                // Check Created in DEC 2025
                if (created.getFullYear() === 2025 && created.getMonth() === 11) {
                    phaseDecCount++;
                    totalDecCreated++;

                    // Classify
                    if (phase.name.toLowerCase().includes('ganho')) decStats.won++;
                    else if (phase.name.toLowerCase().includes('perdido')) decStats.lost++;
                    else decStats.qualified++; // Assuming active = qualified for now
                } else {
                    totalOtherCreated++;
                }

                // Check "Sales" (Won in Dec) independent of creation
                if (phase.name.toLowerCase().includes('ganho')) {
                    // Logic: If status is Won, and finished_at or updated_at is in Dec 2025
                    const wonDate = c.finished_at ? new Date(c.finished_at) : (c.updated_at ? new Date(c.updated_at) : null);
                    if (wonDate && wonDate.getFullYear() === 2025 && wonDate.getMonth() === 11) {
                        // This is a SALE in Dec
                        // We track this separately if needed, but user said "Vendas = 10"
                    }
                }
            });

            hasNext = json.data.phase.cards.pageInfo.hasNextPage;
            cursor = json.data.phase.cards.pageInfo.endCursor;

            // Safety break for huge phases if needed, but we want accuracy
            // Limit "Perdido" only? 
            if (phase.cards_count > 500 && pCount > 20) {
                // If we scanned 1000 cards and found recent ones? 
                // Phase cards are usually ordered by position.
            }
            pCount++;
        }
        console.log(`Found ${phaseDecCount} Dec Leads.`);
    }

    console.log(`\n\n=== FINAL RESULTS ===`);
    console.log(`Total Leads Created in Dec 2025: ${totalDecCreated}`);
    console.log(`Breakdown:`);
    console.log(` - Won (Created in Dec): ${decStats.won}`);
    console.log(` - Lost (Created in Dec): ${decStats.lost}`);
    console.log(` - Active/Qualified (Created in Dec): ${decStats.qualified}`);

    // Also explicitly list the Sales count based on Phase 338889923 scan we did
    // (We need to re-scan that phase more carefully if the numbers don't match)
}

fullScan();
