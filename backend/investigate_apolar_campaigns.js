require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');

async function investigateApolarCampaigns() {
    try {
        console.log('Investigating Apolar vs Andar campaigns...\n');

        // Get both companies
        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        const { data: andar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Companies:');
        console.log(`  Apolar: ${apolar.name} (ID: ${apolar.id})`);
        console.log(`  Andar: ${andar.name} (ID: ${andar.id})`);
        console.log('');

        // Get integrations
        const { data: apolarIntegration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        const { data: andarIntegration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', andar.id)
            .eq('type', 'meta_ads')
            .single();

        console.log('Ad Account IDs:');
        console.log(`  Apolar: ${apolarIntegration?.metaAdAccountId || 'none'}`);
        console.log(`  Andar: ${andarIntegration?.metaAdAccountId || 'none'}`);
        console.log('');

        if (apolarIntegration?.metaAdAccountId === andarIntegration?.metaAdAccountId) {
            console.log('⚠️  SAME AD ACCOUNT! Apolar and Andar share the same Meta Ads account.\n');
        }

        // Fetch campaigns and look for Apolar-specific ones
        const accessToken = decrypt(apolarIntegration.metaAccessToken);
        const adAccountId = apolarIntegration.metaAdAccountId;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const campaigns = await metaAdsService.getCampaignInsights(
            adAccountId,
            accessToken,
            {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        );

        console.log(`Total campaigns in account: ${campaigns.length}\n`);

        // Analyze campaign names
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

        console.log('Campaign breakdown by name:');
        console.log(`  APOLAR campaigns: ${apolarCampaigns.length}`);
        console.log(`  ANDAR campaigns: ${andarCampaigns.length}`);
        console.log(`  Other campaigns: ${otherCampaigns.length}`);
        console.log('');

        if (apolarCampaigns.length > 0) {
            console.log('Sample APOLAR campaigns:');
            apolarCampaigns.slice(0, 5).forEach(c => {
                console.log(`  ${c.campaign_name}`);
                console.log(`    Spend: R$ ${c.spend}, Leads: ${c.leads}`);
            });
            console.log('');

            const apolarTotal = apolarCampaigns.reduce((sum, c) => ({
                spend: sum.spend + c.spend,
                leads: sum.leads + c.leads
            }), { spend: 0, leads: 0 });

            console.log(`APOLAR TOTAL: R$ ${apolarTotal.spend.toFixed(2)} / ${apolarTotal.leads} leads\n`);
        } else {
            console.log('❌ NO APOLAR-SPECIFIC CAMPAIGNS FOUND!\n');
            console.log('This means:');
            console.log('  1. Apolar does not have separate campaigns');
            console.log('  2. OR campaigns are not labeled with "APOLAR" in the name');
            console.log('  3. OR Apolar should use a different Ad Account\n');
        }

        if (andarCampaigns.length > 0) {
            const andarTotal = andarCampaigns.reduce((sum, c) => ({
                spend: sum.spend + c.spend,
                leads: sum.leads + c.leads
            }), { spend: 0, leads: 0 });

            console.log(`ANDAR TOTAL: R$ ${andarTotal.spend.toFixed(2)} / ${andarTotal.leads} leads\n`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

investigateApolarCampaigns();
