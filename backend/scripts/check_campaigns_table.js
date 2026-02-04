require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkCampaigns() {
    console.log("🕵️‍♀️ Checking 'campaigns' table...");

    // Apolar ID
    const companyId = '5b936bf7-39ab-4f19-b636-818d6281dbd8';

    try {
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('company_id', companyId)
            .gte('start_date', '2026-01-01');

        if (error) {
            console.error("DB Error:", error);
            return;
        }

        console.log(`Found ${campaigns.length} campaign records for Apolar.`);
        if (campaigns.length > 0) {
            console.log("Sample Campaign Keys:", Object.keys(campaigns[0]));
            if (campaigns[0].daily_insights) {
                console.log("✅ Found daily_insights column!");
            } else if (campaigns[0].insights) {
                console.log("✅ Found insights column!");
            } else {
                console.log("❌ No obvious insights column found.");
            }
        } else {
            console.warn("⚠️ NO CAMPAIGNS FOUND! This explains the 0.00 display.");
        }

    } catch (e) {
        console.error(e);
    }
}

checkCampaigns();
