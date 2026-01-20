require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');

async function showApolarMetaAdsData() {
    try {
        console.log('=== FETCHING DATA DIRECTLY FROM META ADS API ===\n');

        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Company:', apolar.name);
        console.log('');

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        console.log('Ad Account ID:', integration.metaAdAccountId);
        console.log('');

        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = integration.metaAdAccountId;

        // Fetch for current month (Mês Atual)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const today = new Date();

        const startDate = startOfMonth.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        console.log('Date Range (Mês Atual):');
        console.log('  Start:', startDate);
        console.log('  End:', endDate);
        console.log('');

        console.log('Fetching from Meta Ads API...\n');

        const campaigns = await metaAdsService.getCampaignInsights(
            adAccountId,
            accessToken,
            { startDate, endDate }
        );

        console.log(`Total campaign records returned: ${campaigns.length}\n`);

        // Show ALL campaigns
        console.log('=== ALL CAMPAIGNS FROM API ===\n');

        const uniqueCampaigns = {};
        campaigns.forEach(c => {
            if (!uniqueCampaigns[c.campaign_name]) {
                uniqueCampaigns[c.campaign_name] = {
                    name: c.campaign_name,
                    spend: 0,
                    leads: 0,
                    impressions: 0,
                    clicks: 0,
                    dates: []
                };
            }
            uniqueCampaigns[c.campaign_name].spend += c.spend;
            uniqueCampaigns[c.campaign_name].leads += c.leads;
            uniqueCampaigns[c.campaign_name].impressions += c.impressions;
            uniqueCampaigns[c.campaign_name].clicks += c.clicks;
            uniqueCampaigns[c.campaign_name].dates.push(c.date);
        });

        Object.values(uniqueCampaigns).forEach((camp, i) => {
            console.log(`${i + 1}. ${camp.name}`);
            console.log(`   Spend: R$ ${camp.spend.toFixed(2)}`);
            console.log(`   Leads: ${camp.leads}`);
            console.log(`   Impressions: ${camp.impressions}`);
            console.log(`   Clicks: ${camp.clicks}`);
            console.log(`   Days: ${camp.dates.length}`);
            console.log('');
        });

        // Calculate totals
        const total = campaigns.reduce((acc, c) => ({
            spend: acc.spend + c.spend,
            leads: acc.leads + c.leads,
            impressions: acc.impressions + c.impressions,
            clicks: acc.clicks + c.clicks
        }), { spend: 0, leads: 0, impressions: 0, clicks: 0 });

        console.log('=== TOTAL FROM META ADS API ===');
        console.log(`Spend: R$ ${total.spend.toFixed(2)}`);
        console.log(`Leads: ${total.leads}`);
        console.log(`Impressions: ${total.impressions}`);
        console.log(`Clicks: ${total.clicks}`);
        console.log(`CPL: R$ ${total.leads > 0 ? (total.spend / total.leads).toFixed(2) : '0.00'}`);
        console.log('');

        console.log('=== COMPARISON ===');
        console.log('USER REPORTED (from Meta Ads interface):');
        console.log('  Spend: R$ 1.900,85');
        console.log('  Leads: 19');
        console.log('  CPL: R$ 100,04');
        console.log('');
        console.log('API RETURNED:');
        console.log(`  Spend: R$ ${total.spend.toFixed(2)}`);
        console.log(`  Leads: ${total.leads}`);
        console.log(`  CPL: R$ ${total.leads > 0 ? (total.spend / total.leads).toFixed(2) : '0.00'}`);
        console.log('');

        if (Math.abs(total.spend - 1900.85) < 10) {
            console.log('✅ VALUES MATCH!');
        } else {
            console.log('❌ VALUES DO NOT MATCH!');
            console.log('');
            console.log('This means the Ad Account ID might be wrong,');
            console.log('or the API is returning data from a different account.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

showApolarMetaAdsData();
