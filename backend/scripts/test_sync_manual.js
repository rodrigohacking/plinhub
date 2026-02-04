
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { decrypt } = require('../src/utils/encryption');
const metaAdsService = require('../src/services/metaAds.service');

// Load environment variables directly
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !SERVICE_KEY) {
    console.error("❌ Credentials missing.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, SERVICE_KEY);

const COMPANY_ID = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar (from previous logs)

async function debugSync() {
    console.log("🔍 Fetching Integration...");
    const { data: integration } = await supabase
        .from('Integration')
        .select('*')
        .eq('companyId', COMPANY_ID)
        .eq('type', 'meta_ads')
        .single();

    if (!integration) {
        console.error("❌ Integration not found.");
        return;
    }

    console.log("🔓 Decrypting Token...");
    const accessToken = decrypt(integration.metaAccessToken);
    const adAccountId = integration.metaAdAccountId;

    console.log(`✅ Token Decrypted. Ad Account: ${adAccountId}`);
    console.log(`🔑 Token (First 10 chars): ${accessToken.substring(0, 10)}...`);

    // Define Range: Last 5 days including TODAY
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 5);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    console.log(`📅 Fetching Data Range: ${startStr} to ${endStr}`);

    try {
        const campaigns = await metaAdsService.getCampaignInsights(
            adAccountId,
            accessToken,
            { startDate: startStr, endDate: endStr },
            [], null
        );

        console.log(`\n📊 RESULTS (${campaigns.length} records):`);
        if (campaigns.length === 0) {
            console.log("⚠️ NO DATA RETURNED FROM FACEBOOK API.");
        } else {
            campaigns.forEach(c => {
                console.log(`   - [${c.date}] ${c.campaign_name}: Invest R$ ${c.spend} | Leads: ${c.leads}`);
            });
        }

    } catch (e) {
        console.error("❌ API Fetch Error:", e.response?.data || e.message);
    }
}

debugSync();
