const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');
const axios = require('axios');

async function validateTokens() {
    console.log('--- Starting Meta Token Validation ---');

    try {
        // 1. Fetch all meta_ads integrations
        const { data: integrations, error } = await supabase
            .from('Integration')
            .select('*')
            .eq('type', 'meta_ads');

        if (error) {
            console.error('Error fetching integrations:', error.message);
            return;
        }

        console.log(`Found ${integrations.length} Meta Ads integrations.`);

        for (const integration of integrations) {
            console.log(`\n------------------------------------------------`);
            console.log(`Checking Company ID: ${integration.companyId}`);
            console.log(`Ad Account ID: ${integration.metaAdAccountId}`);

            try {
                const accessToken = decrypt(integration.metaAccessToken);
                // Mask token for log
                console.log(`Token (Decrypted): ${accessToken.substring(0, 10)}...`);

                // 2. Validate Token via /me
                try {
                    const meRes = await axios.get(`https://graph.facebook.com/v24.0/me?access_token=${accessToken}`);
                    console.log(`✅ Token Valid. User: ${meRes.data.name} (ID: ${meRes.data.id})`);
                } catch (e) {
                    console.error(`❌ Token Invalid /me check failed:`, e.response?.data || e.message);
                    continue; // Skip insights check if token is dead
                }

                // 3. Test Insights with date_preset='this_month'
                const actId = integration.metaAdAccountId.startsWith('act_')
                    ? integration.metaAdAccountId
                    : `act_${integration.metaAdAccountId}`;

                const url = `https://graph.facebook.com/v24.0/${actId}/insights`;
                const params = {
                    access_token: accessToken,
                    date_preset: 'this_month',
                    level: 'campaign',
                    time_increment: 1, // DAILY BREAKDOWN
                    fields: 'campaign_name,spend,impressions,date_start',
                    filtering: JSON.stringify([{
                        field: 'campaign.effective_status',
                        operator: 'IN',
                        value: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES']
                    }])
                };

                console.log(`Testing Insights with date_preset='this_month' + Daily + Filters...`);
                let allData = [];
                let pageUrl = url;
                let pageParams = params;

                try {
                    while (pageUrl) {
                        const insightsRes = await axios.get(pageUrl, { params: pageParams });
                        const data = insightsRes.data.data;
                        if (data) allData.push(...data);

                        if (insightsRes.data.paging && insightsRes.data.paging.next) {
                            pageUrl = insightsRes.data.paging.next;
                            pageParams = {}; // Next URL has params
                        } else {
                            pageUrl = null;
                        }
                    }

                    console.log(`✅ Insights Fetch Success!`);
                    console.log(`Returned ${allData.length} daily records.`);

                    if (allData.length > 0) {
                        const totalSpend = allData.reduce((acc, row) => acc + parseFloat(row.spend || 0), 0);
                        console.log(`Total Spend (Sum of Dailies): ${totalSpend.toFixed(2)}`);
                        const uniqueCampaigns = new Set(allData.map(d => d.campaign_name));
                        console.log(`Unique Campaigns: ${uniqueCampaigns.size}`);
                        // Log array of campaigns and their total spend
                        // const campaignSpends = {};
                        // allData.forEach(d => {
                        //     campaignSpends[d.campaign_name] = (campaignSpends[d.campaign_name] || 0) + parseFloat(d.spend || 0);
                        // });
                        // console.log('Campaign Breakdowns:', campaignSpends);

                    } else {
                        console.warn(`⚠️ No data returned.`);
                    }

                } catch (e) {
                    console.error(`❌ Insights Fetch Failed (400?):`, e.response?.data || e.message);
                }

            } catch (err) {
                console.error('Error processing integration:', err.message);
            }
        }

    } catch (err) {
        console.error('Fatal Script Error:', err);
    }
}

validateTokens();
