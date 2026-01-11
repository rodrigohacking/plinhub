
const axios = require('axios');
const fs = require('fs');

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function dumpTitles() {
    let hasNextPage = true;
    let cursor = null;
    const stream = fs.createWriteStream('card_dump.txt');

    console.log("Dumping all cards...");

    while (hasNextPage) {
        const queryCards = `
            query {
                allCards(pipeId: ${PIPE_ID}, first: 50, after: ${cursor ? `"${cursor}"` : null}) {
                    edges {
                        node {
                            id
                            title
                            current_phase { name }
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

        try {
            const res = await axios.post('https://api.pipefy.com/graphql', { query: queryCards }, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
            });

            const cards = res.data.data.allCards.edges.map(e => e.node);
            cards.forEach(c => {
                stream.write(`[${c.id}] [${c.current_phase ? c.current_phase.name : 'NO_PHASE'}] ${c.title}\n`);
            });

            hasNextPage = res.data.data.allCards.pageInfo.hasNextPage;
            cursor = res.data.data.allCards.pageInfo.endCursor;
            process.stdout.write('.');
        } catch (e) {
            console.error(e.message);
            break;
        }
    }
    console.log("\nDone.");
    stream.end();
}

dumpTitles();
