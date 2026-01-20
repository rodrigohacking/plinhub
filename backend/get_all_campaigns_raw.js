require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const axios = require('axios');

async function getAllCampaignsRaw() {
    try {
        console.log('=== BUSCANDO TODAS AS CAMPANHAS (SEM FILTRO) ===\n');

        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = '1060992149132250';

        console.log('Ad Account:', adAccountId);
        console.log('');

        // Direct API call without date filter
        const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`;

        console.log('Buscando campanhas diretamente da API...\n');

        const response = await axios.get(url, {
            params: {
                access_token: accessToken,
                fields: 'id,name,status,effective_status',
                limit: 100
            }
        });

        const campaigns = response.data.data;

        console.log(`Total de campanhas: ${campaigns.length}\n`);

        if (campaigns.length > 0) {
            console.log('=== TODAS AS CAMPANHAS ===\n');

            const apolarCampaigns = [];
            const andarCampaigns = [];
            const otherCampaigns = [];

            campaigns.forEach(c => {
                const nameUpper = c.name.toUpperCase();
                if (nameUpper.includes('APOLAR')) {
                    apolarCampaigns.push(c);
                } else if (nameUpper.includes('ANDAR')) {
                    andarCampaigns.push(c);
                } else {
                    otherCampaigns.push(c);
                }
            });

            console.log(`APOLAR: ${apolarCampaigns.length} campanhas`);
            console.log(`ANDAR: ${andarCampaigns.length} campanhas`);
            console.log(`Outros: ${otherCampaigns.length} campanhas`);
            console.log('');

            if (apolarCampaigns.length > 0) {
                console.log('=== CAMPANHAS APOLAR ===\n');
                apolarCampaigns.forEach((c, i) => {
                    console.log(`${i + 1}. ${c.name}`);
                    console.log(`   ID: ${c.id}`);
                    console.log(`   Status: ${c.status}`);
                    console.log(`   Effective Status: ${c.effective_status}`);
                    console.log('');
                });
            } else {
                console.log('❌ NENHUMA CAMPANHA APOLAR ENCONTRADA!\n');
                console.log('Isso significa que:');
                console.log('  1. As campanhas não existem neste Ad Account');
                console.log('  2. O token não tem permissão para vê-las');
                console.log('  3. As campanhas estão em outro Ad Account');
            }

            // Show some ANDAR campaigns for comparison
            if (andarCampaigns.length > 0) {
                console.log('\n=== CAMPANHAS ANDAR (primeiras 5) ===\n');
                andarCampaigns.slice(0, 5).forEach((c, i) => {
                    console.log(`${i + 1}. ${c.name}`);
                    console.log(`   Status: ${c.status} / ${c.effective_status}`);
                });
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

getAllCampaignsRaw();
