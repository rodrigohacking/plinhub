require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');
const axios = require('axios');

async function debugApolar() {
    console.log('--- Debugging Apolar Condominios ---');

    try {
        // 1. Find the company
        // We look for name containing 'Apolar'
        const { data: companies } = await supabase
            .from('Company')
            .select('id, name')
            .ilike('name', '%Apolar%');

        if (!companies || companies.length === 0) {
            console.error('Company not found');
            return;
        }

        for (const company of companies) {
            console.log(`\nChecking Company: ${company.name} (${company.id})`);

            const { data: integration } = await supabase
                .from('Integration')
                .select('*')
                .eq('companyId', company.id)
                .eq('type', 'meta_ads')
                .single();

            if (!integration) {
                console.log('No Meta Ads integration found.');
                continue;
            }

            const accessToken = decrypt(integration.metaAccessToken);
            const adAccountId = integration.metaAdAccountId;
            const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

            console.log(`Ad Account: ${actId}`);

            // 2. Fetch Insights with EXACT logic from service
            const todayStr = new Date().toISOString().split('T')[0];
            const url = `https://graph.facebook.com/v24.0/${actId}/insights`;
            const params = {
                access_token: accessToken,
                date_preset: 'this_month',
                level: 'campaign',
                time_increment: 1, // DAILY
                date_preset: 'this_month',
                level: 'campaign',
                time_increment: 1, // DAILY
                fields: 'campaign_id,campaign_name,spend,date_start',
                limit: 100,
                filtering: JSON.stringify([{
                    field: 'campaign.effective_status',
                    operator: 'IN',
                    value: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES']
                }])
            };

            console.log('Fetching all pages...');
            let allData = [];
            let pageUrl = url;
            let pageParams = params;

            while (pageUrl) {
                try {
                    const res = await axios.get(pageUrl, { params: pageParams });
                    const data = res.data.data || [];
                    allData.push(...data);

                    if (res.data.paging && res.data.paging.next) {
                        pageUrl = res.data.paging.next;
                        pageParams = {};
                    } else {
                        pageUrl = null;
                    }
                } catch (e) {
                    console.error('API Error:', e.response?.data || e.message);
                    break;
                }
            }

            // 3. Aggregate by Campaign ID to simulate Dashboard Logic
            const campaignStats = {};
            let totalSpend = 0;

            allData.forEach(row => {
                const id = row.campaign_id;
                const spend = parseFloat(row.spend || 0);

                if (!campaignStats[id]) {
                    campaignStats[id] = {
                        name: row.campaign_name,
                        status: row.effective_status,
                        spend: 0,
                        entries: 0
                    };
                }
                campaignStats[id].spend += spend;
                campaignStats[id].entries += 1;
                totalSpend += spend;
            });

            console.log('\n--- Campaign Breakdown ---');
            const sorted = Object.values(campaignStats).sort((a, b) => b.spend - a.spend);

            sorted.forEach(c => {
                console.log(`[${c.status}] ${c.name}: R$ ${c.spend.toFixed(2)} (${c.entries} days)`);
            });

            console.log(`\nTOTAL SPEND (Script): R$ ${totalSpend.toFixed(2)}`);
        }

    } catch (err) {
        console.error(err);
    }
}

debugApolar();
