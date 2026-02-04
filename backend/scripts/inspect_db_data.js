
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = require('../src/utils/supabase');

const COMPANY_ID = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar

async function inspectData() {
    console.log(`🔍 Inspecting Data for Company: ${COMPANY_ID}`);

    // 1. Check Campaigns
    const { data: campaigns, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('company_id', COMPANY_ID)
        .order('start_date', { ascending: false })
        .limit(10);

    if (campError) console.error("Error fetching campaigns:", campError);
    else {
        console.log(`\nFound ${campaigns.length} recent campaigns.`);
        if (campaigns.length > 0) {
            console.log("Sample Campaign:", campaigns[0]);
            console.log("Recents:");
            campaigns.forEach(c => console.log(` - ${c.start_date}: ${c.name} (Invest: ${c.investment})`));
        }
    }

    // 2. Check Metric (Meta Ads Aggregate)
    const { data: metrics, error: metError } = await supabase
        .from('Metric')
        .select('*')
        .eq('companyId', COMPANY_ID)
        .eq('source', 'meta_ads')
        .order('date', { ascending: false })
        .limit(10);

    if (metError) console.error("Error fetching metrics:", metError);
    else {
        console.log(`\nFound ${metrics.length} recent metrics.`);
        if (metrics.length > 0) {
            console.log("Sample Metric:", metrics[0]);
        }
    }
}

inspectData();
