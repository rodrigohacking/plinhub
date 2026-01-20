require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');

async function checkApolarMetaAds() {
    try {
        console.log('Checking Apolar Condominios Meta Ads integration...\n');

        // Find Apolar company
        const { data: companies } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%');

        console.log(`Found ${companies?.length || 0} companies matching "apolar":\n`);
        companies?.forEach(c => {
            console.log(`  - ${c.name} (ID: ${c.id})`);
        });
        console.log('');

        if (!companies || companies.length === 0) {
            console.log('No Apolar company found!');
            return;
        }

        const company = companies[0];
        console.log(`Using company: ${company.name}\n`);

        // Check integrations
        const { data: integrations } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', company.id);

        console.log(`Integrations for ${company.name}:\n`);
        integrations?.forEach(i => {
            console.log(`  - ${i.type}`);
            console.log(`    Active: ${i.isActive}`);
            console.log(`    Last Sync: ${i.lastSync}`);
            if (i.type === 'meta_ads') {
                console.log(`    Ad Account ID: ${i.metaAdAccountId}`);
                console.log(`    Has Token: ${!!i.metaAccessToken}`);
            }
            console.log('');
        });

        // Check if Meta Ads integration exists and is active
        const metaIntegration = integrations?.find(i => i.type === 'meta_ads');

        if (!metaIntegration) {
            console.log('❌ No Meta Ads integration found for Apolar!');
            return;
        }

        if (!metaIntegration.isActive) {
            console.log('❌ Meta Ads integration exists but is NOT ACTIVE!');
            return;
        }

        console.log('✓ Meta Ads integration is active\n');

        // Check metrics in database
        const today = new Date().toISOString().split('T')[0];
        const { data: metrics } = await supabase.from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .order('date', { ascending: false })
            .limit(10);

        console.log(`Meta Ads metrics in database: ${metrics?.length || 0}\n`);

        if (metrics && metrics.length > 0) {
            console.log('Recent Meta Ads metrics:');
            metrics.forEach(m => {
                console.log(`  ${m.date} - Label: ${m.label}`);
                console.log(`    Spend: R$ ${m.spend || 0}`);
                console.log(`    Leads: ${m.cardsCreated || 0}`);
                console.log('');
            });
        } else {
            console.log('❌ No Meta Ads metrics found in database!');
            console.log('This means sync has not run or failed.\n');
        }

        // Check campaigns table
        const { data: campaigns } = await supabase.from('campaigns')
            .select('*')
            .eq('company_id', company.id)
            .order('start_date', { ascending: false })
            .limit(10);

        console.log(`Campaigns in database: ${campaigns?.length || 0}\n`);

        if (campaigns && campaigns.length > 0) {
            console.log('Recent campaigns:');
            campaigns.forEach(c => {
                console.log(`  ${c.start_date} - ${c.name}`);
                console.log(`    Investment: R$ ${c.investment || 0}`);
                console.log(`    Leads: ${c.leads || 0}`);
                console.log('');
            });
        } else {
            console.log('❌ No campaigns found in database!');
            console.log('This means sync has not run or there are no campaigns.\n');
        }

        // Try to fetch from Meta Ads API directly
        if (metaIntegration.metaAccessToken) {
            console.log('Attempting to fetch from Meta Ads API...\n');

            const metaAdsService = require('./src/services/metaAds.service');
            const accessToken = decrypt(metaIntegration.metaAccessToken);
            const adAccountId = metaIntegration.metaAdAccountId;

            try {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const campaignInsights = await metaAdsService.getCampaignInsights(
                    adAccountId,
                    accessToken,
                    {
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0]
                    }
                );

                console.log(`✓ Fetched ${campaignInsights.length} campaign records from Meta Ads API\n`);

                if (campaignInsights.length > 0) {
                    console.log('Sample campaigns from API:');
                    campaignInsights.slice(0, 5).forEach(c => {
                        console.log(`  ${c.date} - ${c.campaign_name}`);
                        console.log(`    Spend: R$ ${c.spend}`);
                        console.log(`    Leads: ${c.leads}`);
                        console.log('');
                    });

                    const totalSpend = campaignInsights.reduce((sum, c) => sum + c.spend, 0);
                    const totalLeads = campaignInsights.reduce((sum, c) => sum + c.leads, 0);

                    console.log(`TOTAL from API: R$ ${totalSpend.toFixed(2)} / ${totalLeads} leads\n`);
                } else {
                    console.log('⚠️  No campaigns found in Meta Ads API for last 30 days');
                }

            } catch (error) {
                console.error('❌ Error fetching from Meta Ads API:', error.message);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

checkApolarMetaAds();
