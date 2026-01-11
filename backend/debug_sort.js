
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function testSort() {
    console.log(`\n\n=== Testing Sort Order on Pipe: ${PIPE_ID} ===`);

    // Attempting to fetch LAST 10 cards (Newest)
    const query = `
        {
          allCards(pipeId: ${PIPE_ID}, last: 10) {
            edges {
              node {
                id
                title
                createdAt
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
            console.error("\nAPI Errors with Sort:", result.errors);
            return;
        }

        const cards = result.data.allCards.edges.map(e => e.node);
        console.log(`Fetched ${cards.length} cards with SORT DESC.`);
        cards.forEach(c => {
            console.log(`[${c.createdAt}] ${c.title}`);
        });

    } catch (e) {
        console.error("Script Error:", e);
    }
}

testSort();
