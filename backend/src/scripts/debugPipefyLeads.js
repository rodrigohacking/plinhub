require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');
const axios = require('axios');

async function debugPipefyLeads() {
    console.log('--- Debugging Pipefy Lost Leads ---');

    try {
        const companyId = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar Condominios

        const { data: integration } = await supabase
            .from('Integration')
            .select('*')
            .eq('companyId', companyId)
            .eq('type', 'pipefy')
            .single();

        console.log(`Env Key Loaded: ${!!process.env.ENCRYPTION_KEY}`);

        if (!integration) {
            console.error('No Pipefy integration found.');
            return;
        }

        const pipeId = integration.pipefyPipeId;
        const accessToken = decrypt(integration.pipefyToken);

        console.log(`Pipe ID: ${pipeId}`);

        const query = `
            {
                pipe(id: ${pipeId}) {
                    phases {
                        id
                        name
                        cards(first: 50) {
                            edges {
                                node {
                                    id
                                    title
                                    createdAt
                                    current_phase { name }
                                    labels { name }
                                }
                            }
                        }
                    }
                }
            }
        `;

        const res = await axios.post('https://api.pipefy.com/graphql', { query }, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        const phases = res.data.data.pipe.phases;
        let allCards = [];

        phases.forEach(p => {
            if (p.cards && p.cards.edges) {
                p.cards.edges.forEach(e => {
                    const c = e.node;
                    const pName = (c.current_phase.name || '').toLowerCase();
                    const isLost = pName.includes('perdido') || pName.includes('cancelado') || pName.includes('descarte');

                    if (isLost) {
                        allCards.push({
                            id: c.id,
                            title: c.title,
                            phase: c.current_phase.name,
                            labels: c.labels.map(l => l.name),
                            createdAt: c.createdAt
                        });
                    }
                });
            }
        });

        console.log(`\nFound ${allCards.length} Lost Cards in Pipe.`);

        // Log all with breakdown
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        console.log(`\n--- ALL LOST CARDS ---`);
        allCards.forEach(c => {
            const hasMetaTag = c.labels.some(l => l.toUpperCase().includes('META ADS'));
            const isThisMonth = new Date(c.createdAt) >= startOfMonth;
            const dateStr = c.createdAt.split('T')[0];

            console.log(`[${dateStr}] [${hasMetaTag ? 'TAG' : 'NO'}] ${c.title} (ThisMonth: ${isThisMonth})`);
        });

    } catch (err) {
        console.error(err.response?.data || err.message);
    }
}

debugPipefyLeads();
