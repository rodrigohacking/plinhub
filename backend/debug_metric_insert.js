require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function debugMetricInsert() {
    try {
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Testing direct metric insert...\n');
        console.log('Company ID:', company.id);
        console.log('');

        const today = new Date().toISOString().split('T')[0];

        // Try to insert a test metric
        const testPayload = {
            companyId: company.id,
            source: 'meta_ads',
            date: today,
            label: 'condominial',
            spend: 1996.82,
            impressions: 10000,
            clicks: 500,
            leads: 51,
            conversions: 0,
            cpc: 3.99,
            cpm: 199.68,
            ctr: 5.0
        };

        console.log('Attempting to insert test metric:');
        console.log(JSON.stringify(testPayload, null, 2));
        console.log('');

        const { data: inserted, error: insertError } = await supabase
            .from('Metric')
            .insert(testPayload)
            .select();

        if (insertError) {
            console.error('INSERT ERROR:', insertError);
        } else {
            console.log('✓ Insert successful!');
            console.log('Inserted record:', inserted);
        }

        // Try to read it back
        console.log('\nAttempting to read back...');

        const { data: readBack, error: readError } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .eq('label', 'condominial')
            .eq('date', today);

        if (readError) {
            console.error('READ ERROR:', readError);
        } else {
            console.log(`✓ Found ${readBack?.length || 0} records`);
            if (readBack && readBack.length > 0) {
                console.log('Record:', readBack[0]);
            }
        }

        // Check all metrics for this company
        console.log('\nAll metrics for this company:');
        const { data: allMetrics } = await supabase
            .from('Metric')
            .select('id, date, source, label')
            .eq('companyId', company.id)
            .order('date', { ascending: false })
            .limit(10);

        console.log(`Total: ${allMetrics?.length || 0}`);
        allMetrics?.forEach(m => {
            console.log(`  ${m.date} - ${m.source} - ${m.label} (ID: ${m.id})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugMetricInsert();
