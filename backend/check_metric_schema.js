require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function checkMetricSchema() {
    try {
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Checking Metric table schema...\n');

        // Get one existing metric to see its structure
        const { data: sampleMetric } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .limit(1)
            .single();

        if (sampleMetric) {
            console.log('Sample Metric record structure:');
            console.log(JSON.stringify(sampleMetric, null, 2));
            console.log('\nAvailable columns:');
            Object.keys(sampleMetric).forEach(key => {
                console.log(`  - ${key}: ${typeof sampleMetric[key]}`);
            });
        } else {
            console.log('No metrics found');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkMetricSchema();
