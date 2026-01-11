
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";
const TARGET_TITLE = "DOM HENRIQUE";

async function investigate() {
    console.log("=== Investigating Pipe 306438109 ===");

    // 1. Get Pipe Stats
    const queryPipe = `
    query {
      pipe(id: ${PIPE_ID}) {
        phases {
          id
          name
          cards_count
        }
      }
    }
  `;

    try {
        const resPipe = await axios.post('https://api.pipefy.com/graphql', { query: queryPipe }, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
        });

        const phases = resPipe.data.data.pipe.phases;
        let totalCards = 0;
        phases.forEach(p => {
            console.log(`Phase: ${p.name} (ID: ${p.id}) - Count: ${p.cards_count}`);
            totalCards += p.cards_count;
        });
        console.log(`TOTAL CARDS IN PIPE: ${totalCards}`);

        // 2. Dump all 'Won' Phase Cards
        console.log(`\n=== Dumping 'Won' Phase Cards ===`);

        // IDs: 338889923 (Fechamento - Ganho), 338889934 (Apólice Fechada)
        const wonPhaseIds = ['338889923', '338889934'];

        let hasNextPage = true;
        let cursor = null;
        let pages = 0;

        // We can't filter by phase in allCards easily without getting all.
        // But since total pipe is 2247, we can just fetch ALL and filter in memory locally.
        // It's small enough.

        let allCards = [];

        while (hasNextPage) {
            const queryCards = `
                query {
                    allCards(pipeId: ${PIPE_ID}, first: 50, after: ${cursor ? `"${cursor}"` : null}) {
                        edges {
                            node {
                                id
                                title
                                current_phase { name id }
                                created_at
                                finished_at
                                updated_at
                            }
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }
            `;

            const res = await axios.post('https://api.pipefy.com/graphql', { query: queryCards }, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
            });

            const pageCards = res.data.data.allCards.edges.map(e => e.node);
            allCards = allCards.concat(pageCards);

            hasNextPage = res.data.data.allCards.pageInfo.hasNextPage;
            cursor = res.data.data.allCards.pageInfo.endCursor;
            process.stdout.write(`\rFetching: ${allCards.length} cards...`);
        }

        console.log("\nFiltering for Won cards...");
        const wonCards = allCards.filter(c => wonPhaseIds.includes(c.current_phase.id));

        console.log(`Found ${wonCards.length} Won cards.`);
        wonCards.forEach(c => {
            console.log(`[${c.current_phase.name}] ${c.title} (Updated: ${c.updated_at})`);
            if (c.title.toUpperCase().includes('HENR')) console.log("   ^^^ POTENTIAL MATCH ^^^");
        });




    } catch (error) {
        console.error("Error:", error.message);
    }
}

investigate();
