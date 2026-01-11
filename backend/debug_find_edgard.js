
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";

async function run() {
    console.log("=== Global Pipe Discovery & Search ===");

    // 1. List All Organizations and Pipes
    const orgQuery = `
      {
        organizations {
          id
          name
          pipes {
            id
            name
          }
        }
      }
    `;

    try {
        const orgRes = await fetch('https://api.pipefy.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ query: orgQuery })
        });

        const orgData = await orgRes.json();
        if (orgData.errors) {
            console.error("Org Query Error:", orgData.errors);
            return;
        }

        const orgs = orgData.data.organizations;
        console.log(`Found ${orgs.length} Organizations.`);

        const allPipes = [];
        orgs.forEach(org => {
            console.log(`\n[Org: ${org.name}]`);
            org.pipes.forEach(p => {
                console.log(`  - Pipe: ${p.name} (ID: ${p.id})`);
                allPipes.push(p.id);
            });
        });

        // 2. Search for "Edgard" in EACH pipe
        console.log("\n\n=== Searching for 'Edgard' in all pipes ===");

        for (const pipeId of allPipes) {
            const searchQuery = `
            {
                cards(pipe_id: ${pipeId}, search: {title: "Edgard"}) {
                    edges {
                        node {
                            id
                            title
                            current_phase { name id }
                            createdAt
                            updated_at
                        }
                    }
                }
            }
            `;

            const searchRes = await fetch('https://api.pipefy.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({ query: searchQuery })
            });

            const searchData = await searchRes.json();
            if (searchData.data && searchData.data.cards) {
                const matches = searchData.data.cards.edges.map(e => e.node);
                if (matches.length > 0) {
                    console.log(`\n!!! FOUND MATCH IN PIPE ${pipeId} !!!`);
                    matches.forEach(m => {
                        console.log(`  Title: ${m.title}`);
                        console.log(`  ID: ${m.id}`);
                        console.log(`  Phase: ${m.current_phase.name} (${m.current_phase.id})`);
                        console.log(`  Created: ${m.createdAt}`);
                        console.log(`  Updated: ${m.updated_at}`);
                    });
                }
            }
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

run();
