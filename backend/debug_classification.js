
const fetch = globalThis.fetch;

const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID = "306438109";

// --- MIMIC PIPEFY.JS CLASSIFICATION LOGIC ---
function classify(card) {
    let status = 'new';
    const phaseName = (card.current_phase?.name?.toLowerCase() || '').trim();
    const phaseId = String(card.current_phase?.id || '').trim();
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const normPhaseName = normalize(phaseName);

    if (phaseId === '338889931' || normPhaseName.includes('perdido') || normPhaseName.includes('negocio perdido') || normPhaseName.includes('lost')) {
        status = 'lost';
    } else if (phaseId === '338889923' || normPhaseName.includes('ganho') || normPhaseName.includes('won') || normPhaseName.includes('vendido') || normPhaseName.includes('assinado')) {
        status = 'won';
    } else if (normPhaseName.includes('qualificado') || normPhaseName.includes('potencial') || normPhaseName.includes('negociacao')) {
        status = 'qualified';
    }
    return status;
}

async function debugClassification() {
    console.log(`\n\n=== DEBUGGING CLASSIFICATION FOR DEC 2025 ===`);

    // We basically need to fetch everything again to see what matches 'won'.
    // We'll use the "Hybrid" approach manually (simplified).

    // 1. Get Phases
    const phasesRes = await fetch('https://api.pipefy.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ query: `{ pipe(id: ${PIPE_ID}) { phases { id name } } }` })
    });
    const phases = (await phasesRes.json()).data.pipe.phases;

    let allCards = [];
    const activePhases = phases.filter(p => p.id !== '338889931'); // Skip lost for speed (assuming 24 won are not there)

    // 2. Fetch Active deep
    for (const p of activePhases) {
        console.log(`Scanning ${p.name}...`);
        // Just page 1 is usually enough to find the 24 culprits if they are active?
        // Wait, 24 is small.
        const q = `{ phase(id: ${p.id}) { cards(first: 50) { edges { node { id title current_phase { name id } finished_at updated_at createdAt } } } } }`;
        const res = await fetch('https://api.pipefy.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({ query: q })
        });
        const json = await res.json();
        if (json.data?.phase?.cards?.edges) {
            allCards.push(...json.data.phase.cards.edges.map(e => e.node));
        }
    }

    // 3. Classify and Filter
    let wonCount = 0;
    console.log("\n--- DETECTED WON DEALS IN DEC 2025 ---");

    allCards.forEach(c => {
        const s = classify(c);
        if (s === 'won') {
            // Check Date
            const created = new Date(c.createdAt);
            const finished = c.finished_at ? new Date(c.finished_at) : null;
            const updated = new Date(c.updated_at);
            const dealDate = finished || updated || created; // Same fallbacks

            if (dealDate.getFullYear() === 2025 && dealDate.getMonth() === 11) {
                wonCount++;
                console.log(`[${wonCount}] ${c.title}`);
                console.log(`   Phase: ${c.current_phase.name} (${c.current_phase.id})`);
                console.log(`   Date: ${dealDate.toISOString()}`);
                console.log(`   Logic: ${finished ? 'Finished' : 'Updated'}`);
                console.log('---');
            }
        }
    });
}

debugClassification();
