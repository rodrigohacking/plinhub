
const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const TARGET_TITLE = "HENRIQUE"; // Searching partial to be safe

const PIPE_IDS = [
    "303453201",
    "305634232",
    "306719932",
    "306656627",
    "306438109" // Include the original one just in case my previous check was bad
];

async function hunt() {
    console.log(`Hunting for '${TARGET_TITLE}' in multiple pipes...`);

    for (const pipeId of PIPE_IDS) {
        console.log(`\nChecking Pipe ID: ${pipeId}`);
        try {
            // Check Pipe Name first
            const qName = `query { pipe(id: ${pipeId}) { name } }`;
            const rName = await axios.post('https://api.pipefy.com/graphql', { query: qName }, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
            });
            console.log(`Pipe Name: ${rName.data.data.pipe.name}`);

            // Search cards
            let hasNextPage = true;
            let cursor = null;
            let foundInPipe = false;
            let checked = 0;

            while (hasNextPage && checked < 500) { // Check first 500 for speed
                const qCards = `
                    query {
                        allCards(pipeId: ${pipeId}, first: 50, after: ${cursor ? `"${cursor}"` : null}) {
                            edges {
                                node {
                                    id
                                    title
                                    current_phase { name }
                                }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `;
                const rCards = await axios.post('https://api.pipefy.com/graphql', { query: qCards }, {
                    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
                });

                const cards = rCards.data.data.allCards.edges.map(e => e.node);
                checked += cards.length;

                const matches = cards.filter(c => c.title.toUpperCase().includes(TARGET_TITLE));
                if (matches.length > 0) {
                    matches.forEach(m => {
                        console.log(`  >>> FOUND MATCH: [${m.id}] ${m.title} (Phase: ${m.current_phase.name})`);
                    });
                    foundInPipe = true;
                }

                hasNextPage = rCards.data.data.allCards.pageInfo.hasNextPage;
                cursor = rCards.data.data.allCards.pageInfo.endCursor;
            }

            if (!foundInPipe) console.log("  No matches in first 500 cards.");

        } catch (e) {
            console.error(`  Error checking pipe ${pipeId}: ${e.message}`);
        }
    }
}

hunt();
