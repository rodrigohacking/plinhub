require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function checkAllApolarMetrics() {
    try {
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Checking ALL Meta Ads metrics for Apolar...\n');

        const { data: allMetrics } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .order('date', { ascending: false });

        console.log(`Total Meta Ads metrics: ${allMetrics?.length || 0}\n`);

        if (allMetrics && allMetrics.length > 0) {
            console.log('ALL Meta Ads metrics:');
            allMetrics.forEach(m => {
                console.log(`  ${m.date} - ${m.label}:`);
                console.log(`    Spend: R$ ${m.spend || 0}`);
                console.log(`    Leads: ${m.cardsCreated || 0}`);
                console.log(`    ID: ${m.id}`);
                console.log('');
            });

            // Check if there are duplicates or old data
            const byLabel = {};
            allMetrics.forEach(m => {
                if (!byLabel[m.label]) byLabel[m.label] = [];
                byLabel[m.label].push(m);
            });

            console.log('\nMetrics grouped by label:');
            Object.keys(byLabel).forEach(label => {
                console.log(`\n${label}: ${byLabel[label].length} records`);
                byLabel[label].forEach(m => {
                    console.log(`  ${m.date}: R$ ${m.spend}, ${m.cardsCreated} leads`);
                });
            });

            // Check for the specific values shown in dashboard
            console.log('\n\n=== LOOKING FOR DASHBOARD VALUES ===');
            console.log('Dashboard shows: R$ 3.031,73 / 171 leads');
            console.log('');

            const matching = allMetrics.filter(m =>
                Math.abs(m.spend - 3031.73) < 1 || m.cardsCreated === 171
            );

            if (matching.length > 0) {
                console.log('Found matching metrics:');
                matching.forEach(m => {
                    console.log(`  ${m.date} - ${m.label}: R$ ${m.spend}, ${m.cardsCreated} leads`);
                });
            } else {
                console.log('No exact match found.');
                console.log('');
                console.log('Possible causes:');
                console.log('  1. Frontend is caching old data');
                console.log('  2. API is aggregating incorrectly');
                console.log('  3. Different date range being used');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkAllApolarMetrics();
