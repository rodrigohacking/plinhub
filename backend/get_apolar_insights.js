require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const axios = require('axios');

async function getApolarCampaignInsights() {
    try {
        console.log('=== BUSCANDO INSIGHTS DAS CAMPANHAS APOLAR ===\n');

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

        // Get current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startDate = startOfMonth.toISOString().split('T')[0];
        const endDate = now.toISOString().split('T')[0];

        console.log(`Período: ${startDate} a ${endDate}\n`);

        // Get insights at account level with filtering
        const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights`;

        console.log('Buscando insights com filtro de campanhas APOLAR...\n');

        const response = await axios.get(url, {
            params: {
                access_token: accessToken,
                time_range: JSON.stringify({
                    since: startDate,
                    until: endDate
                }),
                fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions',
                level: 'campaign',
                time_increment: 1,
                filtering: JSON.stringify([{
                    field: 'campaign.name',
                    operator: 'CONTAIN',
                    value: 'APOLAR'
                }]),
                limit: 100
            }
        });

        const insights = response.data.data;

        console.log(`Insights encontrados: ${insights.length}\n`);

        if (insights.length > 0) {
            // Process insights
            const processedData = insights.map(insight => {
                const leads = insight.actions?.find(a => a.action_type === 'lead')?.value || 0;
                const conversions = insight.actions?.find(a => a.action_type === 'onsite_conversion.post_save')?.value || 0;

                return {
                    campaign_name: insight.campaign_name,
                    date: insight.date_start,
                    spend: parseFloat(insight.spend),
                    impressions: parseInt(insight.impressions),
                    clicks: parseInt(insight.clicks),
                    leads: parseInt(leads),
                    conversions: parseInt(conversions)
                };
            });

            // Group by campaign
            const byCampaign = {};
            processedData.forEach(d => {
                if (!byCampaign[d.campaign_name]) {
                    byCampaign[d.campaign_name] = {
                        spend: 0,
                        leads: 0,
                        impressions: 0,
                        clicks: 0
                    };
                }
                byCampaign[d.campaign_name].spend += d.spend;
                byCampaign[d.campaign_name].leads += d.leads;
                byCampaign[d.campaign_name].impressions += d.impressions;
                byCampaign[d.campaign_name].clicks += d.clicks;
            });

            console.log('=== CAMPANHAS APOLAR COM DADOS ===\n');
            Object.keys(byCampaign).forEach(name => {
                const data = byCampaign[name];
                console.log(`${name}`);
                console.log(`  Spend: R$ ${data.spend.toFixed(2)}`);
                console.log(`  Leads: ${data.leads}`);
                console.log(`  Impressions: ${data.impressions}`);
                console.log(`  Clicks: ${data.clicks}`);
                console.log('');
            });

            // Calculate total
            const total = processedData.reduce((acc, d) => ({
                spend: acc.spend + d.spend,
                leads: acc.leads + d.leads
            }), { spend: 0, leads: 0 });

            console.log('=== TOTAL APOLAR ===');
            console.log(`Investimento: R$ ${total.spend.toFixed(2)}`);
            console.log(`Leads: ${total.leads}`);
            console.log(`CPL: R$ ${total.leads > 0 ? (total.spend / total.leads).toFixed(2) : '0.00'}`);
            console.log('');

            if (Math.abs(total.spend - 1900.85) < 50) {
                console.log('✅ MATCH! Estes são os dados corretos!');
            }

        } else {
            console.log('❌ Nenhum insight encontrado para campanhas APOLAR');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

getApolarCampaignInsights();
