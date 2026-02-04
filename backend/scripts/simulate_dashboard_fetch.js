
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = require('../src/utils/supabase');

const TARGET_COMPANY_ID = '5b936bf7-39ab-4f19-b636-818d6281dbd8';

async function simulateGetData() {
    console.log("🚀 Simulating storage.js getData() logic...");

    // 1. Fetch Companies (Simulated)
    // We assume we know the company ID we care about
    const companyIds = [TARGET_COMPANY_ID];
    console.log("Target Company IDs:", companyIds);

    // 2. Fetch Campaigns (Exactly as in storage.js)
    /*
        const { data: campData, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .in('company_id', companyIds);
    */

    console.log("Fetching campaigns from DB...");
    const { data: campData, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .in('company_id', companyIds);

    if (campError) {
        console.error("❌ Error fetching campaigns:", campError);
        return;
    }

    console.log(`✅ Fetched ${campData.length} raw campaigns.`);

    // 3. Filter for Target Company (as in storage.js)
    /*
         const relevant = dbCampaigns.filter(c => String(c.company_id) === String(company.id));
    */
    const relevant = (campData || []).filter(c => String(c.company_id) === String(TARGET_COMPANY_ID));
    console.log(`✅ Relevant Campaigns (Filter Match): ${relevant.length}`);

    if (relevant.length > 0) {
        console.log("Sample Campaign:", relevant[0]);
    } else {
        console.warn("⚠️ No relevant campaigns found after filter!");
    }

    // 4. Check Date Filtering Logic (Simulating DashboardMarketing.jsx)
    const matches = relevant.filter(c => {
        // Date Logic Check
        const cDate = c.start_date.substring(0, 10);
        // Assuming "This Month" is Feb 2026
        // isDateInSelectedRange logic roughly:
        const d = new Date(c.start_date);
        const now = new Date(); // 2026-02-04
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    console.log(`📅 Matches "This Month" (JS Date Check): ${matches.length}`);
}

simulateGetData();
