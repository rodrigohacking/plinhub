
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const WON_PHASE_ID = "338889923";

async function analyzeWonPhaseSort() {
    console.log(`\n\n=== Analyzing Sort Order of Won Phase (${WON_PHASE_ID}) ===`);

    // Default fetch of phase cards
    const query = `
        {
          phase(id: ${WON_PHASE_ID}) {
            name
            cards(first: 20) {
              edges {
                node {
                  id
                  title
                  finished_at
                  updated_at
                  createdAt
                }
              }
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
            return;
        }

        const cards = result.data.phase.cards.edges.map(e => e.node);
        console.log(`Fetched ${cards.length} cards from Won Phase.`);

        cards.forEach((c, i) => {
            console.log(`[${i + 1}] ${c.title} | Finished: ${c.finished_at}`);
        });

    } catch (e) {
        console.error("Script Error:", e);
    }
}

analyzeWonPhaseSort();
