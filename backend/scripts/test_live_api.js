require('dotenv').config({ path: __dirname + '/../.env' });
// Native fetch is available in Node 18+
const supabase = require('../src/utils/supabase');

async function testLiveApi() {
    console.log("🕵️‍♀️ Testing Live Meta API for Andar Seguros...");
    const companyId = '4072d04e-4110-495e-aa13-16fd41402264';

    // Fetch Credentials from DB to ensure we use what's stored
    const { data: integration } = await supabase
        .from('Integration')
        .select('*')
        .eq('companyId', companyId)
        .eq('type', 'meta_ads') // Specific filter
        .single();

    if (!integration) {
        console.error("❌ No integration found!");
        return;
    }

    const { metaAccessToken, metaAdAccountId } = integration;
    console.log(`🔑 Token: ${metaAccessToken.substring(0, 10)}...`);
    console.log(`wd Account: ${metaAdAccountId}`);

    // Construct Meta API URL (Simulating frontend/backend call logic)
    // We'll call the Graph API directly to isolate from backend proxy issues
    const days = 30; // Test with small range first
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = new Date().toISOString().split('T')[0];

    const fields = 'id,name,status,insights.level(campaign).time_increment(1){spend,impressions,clicks,date_start,date_stop}';
    const url = `https://graph.facebook.com/v17.0/act_${metaAdAccountId}/campaigns?fields=${fields}&access_token=${metaAccessToken}&time_range={'since':'${sinceStr}','until':'${untilStr}'}`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.error) {
            console.error("❌ Meta API Error:", json.error);
        } else {
            console.log(`✅ Success! Found ${json.data ? json.data.length : 0} campaigns.`);

            if (json.data) {
                json.data.forEach(c => {
                    console.log(`\n📋 Campaign: ${c.name} (${c.status})`);
                    const insights = c.insights ? c.insights.data : [];
                    console.log(`   Insights: ${insights.length} days of data`);

                    // Check Total Spend in this period
                    const totalSpend = insights.reduce((sum, day) => sum + parseFloat(day.spend || 0), 0);
                    console.log(`   Total Spend (${days}d): R$ ${totalSpend.toFixed(2)}`);
                });
            }
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testLiveApi();
