require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');
const axios = require('axios');

async function listFebMetaLeads() {
    console.log('--- List Feb 2026 Meta Ads Leads (Andar) ---');
    try {
        const { data: companies } = await supabase.from('Company').select('id, name').ilike('name', '%Andar%');
        const andar = companies[0];
        const { data: integration } = await supabase.from('Integration').select('*').eq('companyId', andar.id).eq('type', 'pipefy').single();
        const accessToken = decrypt(integration.pipefyToken);
        const pipeId = integration.pipefyPipeId;

        // Fetch Phases
        const phaseRes = await axios.post('https://api.pipefy.com/graphql', { query: `{ pipe(id: ${pipeId}) { phases { id name } } }` }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const phasesList = phaseRes.data.data.pipe.phases;

        let allCards = [];
        await Promise.all(phasesList.map(async (phase) => {
            let pCursor = null;
            let pHasNext = true;
            let pCount = 0;
            while (pHasNext && pCount < 20) {
                pCount++;
                const q = `{ phase(id: ${phase.id}) { cards(first: 50${pCursor ? `, after: "${pCursor}"` : ''}) { edges { node { id title current_phase { name id } labels { name } createdAt } } pageInfo { hasNextPage endCursor } } } }`;
                try {
                    const r = await axios.post('https://api.pipefy.com/graphql', { query: q }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                    const d = r.data.data.phase.cards;
                    d.edges.forEach(e => allCards.push(e.node));
                    pHasNext = d.pageInfo.hasNextPage;
                    pCursor = d.pageInfo.endCursor;
                } catch (e) { break; }
            }
        }));

        // Filter Feb 2026 + Meta Ads
        const startFeb = new Date('2026-02-01T00:00:00Z');
        const febMeta = allCards.filter(c => {
            const d = new Date(c.createdAt);
            const hasMeta = c.labels.some(l => l.name.toUpperCase().includes('META ADS'));
            return d >= startFeb && hasMeta;
        });

        console.log(`Total Feb Meta Leads: ${febMeta.length}`);

        febMeta.forEach((c, i) => {
            console.log(`${i + 1}. [${c.current_phase.name}] ${c.title} (ID: ${c.id})`);
        });

    } catch (e) { console.error(e); }
}

listFebMetaLeads();
