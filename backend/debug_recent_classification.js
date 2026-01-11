
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

async function debugRecent() {
    console.log(`\n\n=== DEBUGGING RECENT SWEEP CLASSIFICATION ===`);

    // Mimic the Recent Sweep
    const q = `
    {
        allCards(pipeId: ${PIPE_ID}, last: 300) {
            edges {
                node {
                    id
                    title
                    finished_at
                    updated_at
                    current_phase { name id }
                    createdAt
                    created_at
                }
            }
        }
    }`;

    const res = await fetch('https://api.pipefy.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ query: q })
    });

    const json = await res.json();
    const cards = json.data.allCards.edges.map(e => e.node);

    console.log(`Scanned ${cards.length} recent cards.`);

    let wonCount = 0;

    cards.forEach(c => {
        // Logic from Pipefy.js
        let status = 'new';
        const phaseName = (c.current_phase?.name?.toLowerCase() || '').trim();
        const phaseId = String(c.current_phase?.id || '').trim();
        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normPhaseName = normalize(phaseName);

        if (phaseId === '338889931' || normPhaseName.includes('perdido')) {
            status = 'lost';
        } else if (phaseId === '338889923' || normPhaseName.includes('ganho') || normPhaseName.includes('won')) {
            status = 'won';
        }

        // Date Logic
        const created = new Date(c.createdAt || c.created_at);
        const finished = c.finished_at ? new Date(c.finished_at) : null;
        const updated = new Date(c.updated_at);
        const dealDate = finished || updated || created;

        if (status === 'won' && dealDate.getFullYear() === 2025 && dealDate.getMonth() === 11) {
            wonCount++;
            console.log(`[${wonCount}] ${c.title} | Phase: ${c.current_phase.name} | Date: ${dealDate.toISOString()} | Logic: ${finished ? 'Finished' : 'Updated'}`);
        }
    });

    console.log(`Total Won in Recent Sweep: ${wonCount}`);
}

debugRecent();
