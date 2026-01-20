require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');

async function searchApolarCampaigns() {
    try {
        console.log('=== BUSCANDO CAMPANHAS COM "APOLAR" NO NOME ===\n');

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

        // Try different date ranges
        const dateRanges = [
            {
                name: 'Últimos 7 dias',
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
            },
            {
                name: 'Últimos 30 dias',
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
            },
            {
                name: 'Mês Atual',
                startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
            }
        ];

        for (const range of dateRanges) {
            console.log(`\n=== ${range.name} (${range.startDate} a ${range.endDate}) ===\n`);

            const campaigns = await metaAdsService.getCampaignInsights(
                adAccountId,
                accessToken,
                range
            );

            console.log(`Total de registros: ${campaigns.length}`);

            // Filter for APOLAR campaigns
            const apolarCampaigns = campaigns.filter(c =>
                c.campaign_name.toUpperCase().includes('APOLAR')
            );

            const andarCampaigns = campaigns.filter(c =>
                c.campaign_name.toUpperCase().includes('ANDAR')
            );

            const otherCampaigns = campaigns.filter(c =>
                !c.campaign_name.toUpperCase().includes('APOLAR') &&
                !c.campaign_name.toUpperCase().includes('ANDAR')
            );

            console.log(`  APOLAR: ${apolarCampaigns.length} registros`);
            console.log(`  ANDAR: ${andarCampaigns.length} registros`);
            console.log(`  Outros: ${otherCampaigns.length} registros`);

            if (apolarCampaigns.length > 0) {
                const total = apolarCampaigns.reduce((acc, c) => ({
                    spend: acc.spend + c.spend,
                    leads: acc.leads + c.leads
                }), { spend: 0, leads: 0 });

                console.log(`\n  Total APOLAR:`);
                console.log(`    Investimento: R$ ${total.spend.toFixed(2)}`);
                console.log(`    Leads: ${total.leads}`);
                console.log(`    CPL: R$ ${total.leads > 0 ? (total.spend / total.leads).toFixed(2) : '0.00'}`);

                // Show unique campaign names
                const uniqueNames = [...new Set(apolarCampaigns.map(c => c.campaign_name))];
                console.log(`\n  Campanhas APOLAR (${uniqueNames.length}):`);
                uniqueNames.forEach(name => {
                    const campData = apolarCampaigns.filter(c => c.campaign_name === name);
                    const campTotal = campData.reduce((acc, c) => ({
                        spend: acc.spend + c.spend,
                        leads: acc.leads + c.leads
                    }), { spend: 0, leads: 0 });
                    console.log(`    - ${name}`);
                    console.log(`      R$ ${campTotal.spend.toFixed(2)} / ${campTotal.leads} leads`);
                });

                if (Math.abs(total.spend - 1900.85) < 50) {
                    console.log(`\n  ✅ MATCH! Este período tem os dados corretos!`);
                }
            } else {
                console.log(`\n  ❌ Nenhuma campanha APOLAR encontrada neste período`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

searchApolarCampaigns();
