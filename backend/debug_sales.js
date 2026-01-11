
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function analyzeDecember() {
    console.log(`\n\n=== Analyzing December 2025 Data for Pipe: ${PIPE_ID} ===`);

    // We expect recent cards to be at the "end" of the list, so we use 'last'
    let hasPreviousPage = true;
    let startCursor = null;
    let page = 1;

    let totalDec = 0;
    let wonDec = 0;
    let lostDec = 0;
    let otherDec = 0;

    const decCards = [];

    while (hasPreviousPage && page <= 5) { // Check last 500 cards
        const query = `
        {
          allCards(pipeId: ${PIPE_ID}, last: 100, before: ${startCursor ? `"${startCursor}"` : null}) {
            edges {
              node {
                id
                title
                current_phase { name id }
                createdAt
                created_at
                finished_at
              }
            }
            pageInfo {
              hasPreviousPage
              startCursor
            }
          }
        }
      `;

        try {
            const response = await fetch('https://api.pipefy.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            if (result.errors) {
                console.error("\nAPI Errors:", result.errors);
                break;
            }

            const cards = result.data.allCards.edges.map(e => e.node);

            cards.forEach(c => {
                const created = new Date(c.createdAt || c.created_at);
                // Check if Dec 2025
                if (created.getFullYear() === 2025 && created.getMonth() === 11) { // Month is 0-indexed (11 = Dec)
                    totalDec++;

                    const phaseId = String(c.current_phase.id);
                    const phaseName = c.current_phase.name.toLowerCase();

                    let status = 'Other';
                    if (phaseId === '338889931' || phaseName.includes('perdido')) {
                        status = 'Lost';
                        lostDec++;
                    } else if (phaseId === '338889923' || phaseName.includes('ganho') || c.finished_at) {
                        status = 'Won';
                        wonDec++;
                    } else {
                        otherDec++;
                    }

                    decCards.push({
                        title: c.title,
                        created: created.toISOString(),
                        phase: c.current_phase.name,
                        status: status
                    });
                }
            });

            hasPreviousPage = result.data.allCards.pageInfo.hasPreviousPage;
            startCursor = result.data.allCards.pageInfo.startCursor;
            page++;

        } catch (e) {
            console.error(e);
            break;
        }
    }

    console.log(`\n\n--- December 2025 Summary ---`);
    console.log(`Total Created in Dec: ${totalDec}`);
    console.log(`Won: ${wonDec}`);
    console.log(`Lost: ${lostDec}`);
    console.log(`Other (In Progress): ${otherDec}`);

    if (wonDec === 0) {
        console.log("\nWARNING: No 'Won' deals found in December.");
        console.log("Checking for ANY 'Won' deals in the scan window...");
        // Re-scan local list for any won regardless of date
    }

    console.log("\nSample December Cards:");
    decCards.slice(0, 10).forEach(c => console.log(`  [${c.status}] ${c.title} (${c.phase})`));
}

analyzeDecember();
