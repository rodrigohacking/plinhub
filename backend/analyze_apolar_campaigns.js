require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');

async function analyzeAllCampaigns() {
    try {
        console.log('Analyzing ALL campaigns in Apolar Ad Account...\n');

        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        console.log('Company:', apolar.name);
        console.log('Ad Account:', integration.metaAdAccountId);
        console.log('');

        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = integration.metaAdAccountId;

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

        console.log(`Total campaigns: ${campaigns.length}\n`);

        // Group by unique campaign names
        const uniqueNames = [...new Set(campaigns.map(c => c.campaign_name))];

        console.log(`Unique campaign names: ${uniqueNames.length}\n`);

        // Show all unique names
        console.log('ALL CAMPAIGN NAMES:\n');
        uniqueNames.sort().forEach((name, i) => {
            const campaignData = campaigns.filter(c => c.campaign_name === name);
            const totalSpend = campaignData.reduce((sum, c) => sum + c.spend, 0);
            const totalLeads = campaignData.reduce((sum, c) => sum + c.leads, 0);

            console.log(`${i + 1}. ${name}`);
            console.log(`   Spend: R$ ${totalSpend.toFixed(2)}, Leads: ${totalLeads}`);
            console.log('');
        });

        // Categorize
        const withAndar = uniqueNames.filter(n => n.toUpperCase().includes('ANDAR'));
        const withApolar = uniqueNames.filter(n => n.toUpperCase().includes('APOLAR'));
        const withNeither = uniqueNames.filter(n =>
            !n.toUpperCase().includes('ANDAR') &&
            !n.toUpperCase().includes('APOLAR')
        );

        console.log('\n=== SUMMARY ===\n');
        console.log(`Campaigns with "ANDAR": ${withAndar.length}`);
        console.log(`Campaigns with "APOLAR": ${withApolar.length}`);
        console.log(`Campaigns with neither: ${withNeither.length}`);
        console.log('');

        if (withNeither.length > 0) {
            console.log('Campaigns WITHOUT company identifier:');
            withNeither.forEach(name => {
                console.log(`  - ${name}`);
            });
            console.log('');
            console.log('These campaigns might belong to Apolar but are not labeled.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeAllCampaigns();
