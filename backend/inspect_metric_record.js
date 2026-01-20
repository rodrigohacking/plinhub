require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function inspectMetricRecord() {
    try {
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Inspecting actual metric records...\n');

        const today = new Date().toISOString().split('T')[0];

        const { data: metrics } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .eq('date', today);

        console.log(`Found ${metrics?.length || 0} Meta Ads metrics for today\n`);

        if (metrics && metrics.length > 0) {
            metrics.forEach(m => {
                console.log(`Label: ${m.label}`);
                console.log(`  spend: ${m.spend}`);
                console.log(`  cardsCreated: ${m.cardsCreated}`);
                console.log(`  impressions: ${m.impressions}`);
                console.log(`  clicks: ${m.clicks}`);
                console.log(`  conversions: ${m.conversions}`);
                console.log(`  cpc: ${m.cpc}`);
                console.log(`  Full record:`, JSON.stringify(m, null, 2));
                console.log('');
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

inspectMetricRecord();
