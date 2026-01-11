
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PHASE_ID = "333789285"; // Apolar - Perdido

async function analyzePhase(phaseId) {
  console.log(`\n\n=== Analyzing Phase ID: ${phaseId} ===`);

  let hasNextPage = true;
  let endCursor = null;
  let totalCards = 0;

  // We'll scan up to 10 pages (500 cards) looking for Edgard
  let page = 1;

  while (hasNextPage && page <= 20) {
    process.stdout.write(`Page ${page}... `);

    const query = `
        {
          phase(id: ${phaseId}) {
            name
            cards(first: 50, after: ${endCursor ? `"${endCursor}"` : null}) {
              edges {
                node {
                  id
                  title
                  createdAt
                  created_at
                  updated_at
                }
              }
              pageInfo {
                hasNextPage
                endCursor
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
        break;
      }

      if (!result.data.phase) {
        console.log(`\nPhase ${phaseId} NOT FOUND.`);
        break;
      }

      const cards = result.data.phase.cards.edges.map(e => e.node);
      totalCards += cards.length;

      // Search for target
      const target = cards.find(c => c.title.toLowerCase().includes('edgard') || c.title.toLowerCase().includes('henrique luan'));

      if (target) {
        console.log("\n\n!!! FOUND TARGET CARD !!!");
        console.log(`Title: ${target.title}`);
        console.log(`ID: ${target.id}`);
        console.log(`Created At: ${target.createdAt || target.created_at}`);
        console.log(`Updated At: ${target.updated_at}`);
        return; // Found it!
      }

      hasNextPage = result.data.phase.cards.pageInfo.hasNextPage;
      endCursor = result.data.phase.cards.pageInfo.endCursor;
      page++;

    } catch (e) {
      console.error(e);
      break;
    }
  }
  console.log(`\n\nScanned ${totalCards} cards in phase. Target (Edgard/Henrique Luan) NOT found.`);
}

analyzePhase(PHASE_ID);
