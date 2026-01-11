
const fetch = globalThis.fetch;

const AD_ACCOUNT_ID = "act_631649546531729";
const TOKEN = "EAAQ4U7H5GnABQIcNvnSKtVwZB4aZC1FVZAbpueQbbPXy1ZCkHRKefJaTM8QwCEyl4MPHEEdWYJsA8uRbCW9ZBur0PnGigz2btJE0KcCLLlBHBthf0EJ6czEqtCLPDLZCLM49nxaC7d1ISlqDEnNU7ZAiFXgkWHxid6D2invwXhBKng164mUh150rQxArZC9OntbF630oqZA7t";
const META_API_URL = 'https://graph.facebook.com/v19.0';

async function testMetaDeep() {
    console.log(`Testing Meta Ads Deep Debug...`);

    // 1. Get Account Info (Timezone)
    try {
        const accUrl = `${META_API_URL}/${AD_ACCOUNT_ID}?fields=timezone_name,currency,name&access_token=${TOKEN}`;
        const accRes = await fetch(accUrl);
        const accData = await accRes.json();
        console.log("Account Info:", accData);
    } catch (e) {
        console.error("Account Info Error:", e.message);
    }

    // 2. Fetch Campaigns with Daily Insights (Check Pagination)
    // Fetching insights.limit(100) to see if we were missing days
    const fields = 'id,name,status,objective,insights.time_increment(1).limit(100){date_start,spend,impressions,clicks,actions}';

    const url = `${META_API_URL}/${AD_ACCOUNT_ID}/campaigns?fields=${fields}&limit=50&access_token=${TOKEN}`;

    // 3. Filter for "Current Month" (Jan 2026 based on user time) to debug discrepancy
    // User sees 422, we show 258. Difference ~164.
    const START_DATE = new Date('2026-01-01T00:00:00');
    const END_DATE = new Date('2026-01-31T23:59:59');

    try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.error) {
            console.error("Meta API Error:", JSON.stringify(json.error, null, 2));
            return;
        }

        const campaigns = json.data || [];
        console.log(`\nFound ${campaigns.length} campaigns. Filtering for Jan 2026...\n`);

        let totalSpendAll = 0;
        let totalLeadsAll = 0;

        // Buckets for Analysis
        let spendByObjective = {};

        campaigns.forEach(c => {
            const insights = c.insights?.data || [];

            let campSpend = 0;
            let campLeads = 0;

            insights.forEach(d => {
                // Filter by Date
                const dayDate = new Date(d.date_start + 'T12:00:00'); // Safe Noon
                if (dayDate >= START_DATE && dayDate <= END_DATE) {
                    campSpend += parseFloat(d.spend || 0);

                    const actions = d.actions || [];
                    const leadAction = actions.find(a =>
                        a.action_type === 'lead' ||
                        a.action_type === 'offsite_conversion.fb_pixel_lead' ||
                        a.action_type === 'onsite_conversion.lead_grouped' ||
                        a.action_type.includes('lead')
                    );
                    if (leadAction) campLeads += parseInt(leadAction.value, 10);
                }
            });

            if (campSpend > 0) {
                console.log(`[${c.name}] (${c.status}) - Obj: ${c.objective} - Spend: ${campSpend.toFixed(2)} - Leads: ${campLeads}`);

                totalSpendAll += campSpend;
                totalLeadsAll += campLeads;

                // Accumulate per objective
                if (!spendByObjective[c.objective]) spendByObjective[c.objective] = 0;
                spendByObjective[c.objective] += campSpend;
            }
        });

        console.log("\n=== GRAND TOTALS (Jan 2026) ===");
        console.log(`Total Spend: ${totalSpendAll.toFixed(2)}`);
        console.log(`Total Leads: ${totalLeadsAll}`);

        console.log("\n=== SPEND BY OBJECTIVE ===");
        console.table(spendByObjective);

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testMetaDeep();
