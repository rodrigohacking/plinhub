require('dotenv').config();
const metaAdsService = require('./src/services/metaAds.service');
const { decrypt } = require('./src/utils/encryption');
const supabase = require('./src/utils/supabase');

async function testMetaAdsAndar() {
    try {
        console.log('Finding Andar Seguros integration...\n');

        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        if (!company) {
            console.error('Andar Seguros company not found');
            return;
        }

        console.log('Company:', company.name, '- ID:', company.id);

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', company.id)
            .eq('type', 'meta_ads')
            .eq('isActive', true)
            .single();

        if (!integration) {
            console.error('Meta Ads integration not found');
            return;
        }

        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = integration.metaAdAccountId;

        console.log('Ad Account ID:', adAccountId);
        console.log('');

        // Test connection
        console.log('Testing Meta Ads connection...\n');
        const connection = await metaAdsService.testConnection(accessToken);
        console.log('✓ Connection successful');
        console.log('User:', connection.user.name);
        console.log('Accounts:', connection.accountsCount);
        console.log('');

        // Get campaign insights for last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        console.log(`Fetching campaign insights from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...\n`);

        const campaigns = await metaAdsService.getCampaignInsights(
            adAccountId,
            accessToken,
            {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        );

        console.log(`Total campaign records: ${campaigns.length}\n`);

        // Analyze campaigns by product
        const productKeywords = {
            'CONDOMINIAL': ['condominial', 'condominio'],
            'RC_SINDICO': ['sindico', 'rc sindico'],
            'AUTOMOVEL': ['automovel', 'auto'],
            'RESIDENCIAL': ['residencial']
        };

        console.log('Campaign breakdown by product:\n');

        Object.keys(productKeywords).forEach(product => {
            const keywords = productKeywords[product];
            const productCampaigns = campaigns.filter(c => {
                const name = c.campaign_name.toUpperCase();
                return keywords.some(k => name.includes(k.toUpperCase()));
            });

            const totalSpend = productCampaigns.reduce((sum, c) => sum + c.spend, 0);
            const totalLeads = productCampaigns.reduce((sum, c) => sum + c.leads, 0);

            console.log(`${product}:`);
            console.log(`  Campaigns: ${productCampaigns.length}`);
            console.log(`  Total Spend: R$ ${totalSpend.toFixed(2)}`);
            console.log(`  Total Leads: ${totalLeads}`);
            console.log(`  CPL: R$ ${totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00'}`);
            console.log('');
        });

        // Show sample campaigns
        console.log('Sample campaigns (first 10):');
        campaigns.slice(0, 10).forEach((c, i) => {
            console.log(`${i + 1}. ${c.campaign_name}`);
            console.log(`   Date: ${c.date}`);
            console.log(`   Spend: R$ ${c.spend.toFixed(2)}`);
            console.log(`   Leads: ${c.leads}`);
            console.log('');
        });

        // Total summary
        const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
        const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);

        console.log('TOTAL SUMMARY:');
        console.log(`  Total Spend: R$ ${totalSpend.toFixed(2)}`);
        console.log(`  Total Leads: ${totalLeads}`);
        console.log(`  Average CPL: R$ ${totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00'}`);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testMetaAdsAndar();
