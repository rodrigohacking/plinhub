require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function checkAndarLatest() {
    console.log("🕵️‍♀️ Checking Latest Metrics for Andar Seguros...");
    const companyId = '4072d04e-4110-495e-aa13-16fd41402264';

    try {
        const { data: metrics, error } = await supabase
            .from('Metric')
            .select('date, label, spend, items: cardsCreated')
            .eq('companyId', companyId)
            .eq('source', 'meta_ads')
            .order('date', { ascending: false })
            .limit(10);

        if (error) {
            console.error("DB Error:", error);
            return;
        }

        if (metrics.length > 0) {
            console.log("📅 LATEST 5 DAYS FOUND:");
            console.table(metrics);
        } else {
            console.log("❌ No metrics found for Andar Seguros.");
        }
    } catch (e) {
        console.error(e);
    }
}

checkAndarLatest();
