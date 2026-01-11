
const fetch = globalThis.fetch;

const AD_ACCOUNT_ID = "act_631649546531729";
const TOKEN = "EAAQ4U7H5GnABQajdmZCKnPzXNoVXNU26LHHuq7k1oZC7IorzcdG1Xi9B7jxkciRGPwZCBDpuQp89EZAIYmLbxln20T8pbcQYFDzGUGiizBHvvM6h9onKHdTbU2Vc6xe93m7Xaku230ljVs6NnZBiHDes7o4ux3lsm7E9eUEZAqx3D1gZBa3joN0rNedGnPsvy0VEFcm18f9yvKG6qxcw7oJCzCaP2TmAurXS2eh";
const META_API_URL = 'https://graph.facebook.com/v19.0';

async function testMetaConnection() {
    console.log(`Testing Meta Ads Connection...`);
    console.log(`Account: ${AD_ACCOUNT_ID}`);

    const actId = AD_ACCOUNT_ID.replace('act_', '');
    const fields = 'id,name,start_time,stop_time,status,insights.date_preset(maximum){spend,impressions,clicks,actions,cpc,cpm}';

    // Fetch Campaigns
    const url = `${META_API_URL}/act_${actId}/campaigns?fields=${fields}&access_token=${TOKEN}`;

    try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.error) {
            console.error("Meta API Error:", JSON.stringify(json.error, null, 2));
            return;
        }

        const campaigns = json.data || [];
        console.log(`\nSuccess! Found ${campaigns.length} campaigns.\n`);

        campaigns.slice(0, 5).forEach(c => {
            const insights = c.insights?.data?.[0] || {};
            console.log(`[${c.name}] Status: ${c.status}`);
            console.log(`   Spend: ${insights.spend || 0}`);
            console.log(`   Impressions: ${insights.impressions || 0}`);
            console.log(`   Clicks: ${insights.clicks || 0}`);
            console.log('---');
        });

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testMetaConnection();
