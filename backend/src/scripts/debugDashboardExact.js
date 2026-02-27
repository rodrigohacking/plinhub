require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');
const axios = require('axios');

async function debugDashboardExact() {
    console.log('--- Debugging Dashboard EXACT Internal Logic ---');

    try {
        const { data: companies } = await supabase.from('Company').select('id, name').ilike('name', '%Andar%');
        const andar = companies[0];
        const { data: integration } = await supabase.from('Integration').select('*').eq('companyId', andar.id).eq('type', 'pipefy').single();
        const accessToken = decrypt(integration.pipefyToken);
        const pipeId = integration.pipefyPipeId;

        console.log(`Company: ${andar.name}`);

        // Fetch Raw Cards
        let allEdges = [];
        const phaseRes = await axios.post('https://api.pipefy.com/graphql', { query: `{ pipe(id: ${pipeId}) { phases { id name } } }` }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const phasesList = phaseRes.data.data.pipe.phases;

        await Promise.all(phasesList.map(async (phase) => {
            let pCursor = null;
            let pHasNext = true;
            let pCount = 0;
            while (pHasNext && pCount < 20) {
                pCount++;
                const q = `{ phase(id: ${phase.id}) { cards(first: 50${pCursor ? `, after: "${pCursor}"` : ''}) { edges { node { id title current_phase { name id } labels { name } createdAt updated_at } } pageInfo { hasNextPage endCursor } } } }`;
                try {
                    const r = await axios.post('https://api.pipefy.com/graphql', { query: q }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                    const d = r.data.data.phase.cards;
                    d.edges.forEach(e => allEdges.push(e.node));
                    pHasNext = d.pageInfo.hasNextPage;
                    pCursor = d.pageInfo.endCursor;
                } catch (e) { break; }
            }
        }));

        // SIMULATE DASHBOARD LOGIC (L448 - L468)

        // 1. Filter Leads Created in Feb 2026 (Local Time Simulation)
        const startRaw = new Date('2026-02-01T00:00:00Z'); // Dashboard uses 'this-month' -> YYYY-MM-01

        // Dashboard uses `isDateInSelectedRange` which compares string YYYY-MM-DD
        const startStr = '2026-02-01';
        const endStr = '2026-02-28';

        const leadsList = allEdges.filter(s => {
            // A. Strict Meta Check
            const hasMeta = s.labels.some(l => l.name.toUpperCase().includes('META ADS') || l.name.toUpperCase() === 'META ADS');

            // B. Date Check (Approximate Dashboard isDateInSelectedRange)
            // Dashboard compares strings: date >= start && date <= end
            const d = (s.createdAt || '').split('T')[0];
            const inRange = d >= startStr && d <= endStr;

            return hasMeta && inRange;
        });

        console.log(`Leads List (Feb, Meta Tag): ${leadsList.length}`);

        // 2. Filter Lost
        const lostList = leadsList.filter(s => {
            const pName = (s.current_phase.name || '').toLowerCase();
            // Note: Dashboard doesn't check Phase ID here! It checks NAMES.
            // L461: isLost = s.status === 'lost' || pName.includes('perdido')...
            // But `s.status` comes from `pipefy.js`.
            // Let's assume `pipefy.js` sets status=lost if ID matches.

            // Replicate pipefy.js Status Logic briefly:
            const isIdLost = String(s.current_phase.id) === '338889931';

            const isNameLost = pName.includes('perdido') ||
                pName.includes('cancelado') ||
                pName.includes('descarte') ||
                pName.includes('recusado') ||
                pName.includes('invalido');

            return isIdLost || isNameLost;
        });

        console.log(`Lost List (Calculated): ${lostList.length}`);

        lostList.forEach(c => {
            console.log(`[LOST MATCH] ${c.title} | Phase: ${c.current_phase.name} (${c.current_phase.id}) | Created: ${c.createdAt}`);
        });

    } catch (e) { console.error(e); }
}

debugDashboardExact();
