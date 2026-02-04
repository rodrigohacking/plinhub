require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkMetaMetrics() {
    console.log("🕵️‍♀️ Checking 'Metric' table for Meta Ads...");

    const companyId = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar

    try {
        const { data: metrics, error } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', companyId)
            .eq('source', 'meta_ads')
            .order('date', { ascending: false })
            .limit(5);

        if (error) {
            console.error("DB Error:", error);
            return;
        }

        console.log(`Found ${metrics.length} Meta Ads metrics.`);
        if (metrics.length > 0) {
            console.log("Sample Metric:", metrics[0]);
        } else {
            console.warn("⚠️ NO META ADS METRICS FOUND!");
        }

    } catch (e) {
        console.error(e);
    }
}

checkMetaMetrics();
