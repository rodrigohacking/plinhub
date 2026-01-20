require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function checkApolarAfterSync() {
    try {
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Checking Apolar data after sync...\n');
        console.log('Company:', company.name, '\n');

        // Check campaigns
        const { data: campaigns } = await supabase.from('campaigns')
            .select('*')
            .eq('company_id', company.id)
            .order('start_date', { ascending: false })
            .limit(5);

        console.log(`Campaigns: ${campaigns?.length || 0}`);
        if (campaigns && campaigns.length > 0) {
            campaigns.forEach(c => {
                console.log(`  ${c.start_date} - ${c.name.substring(0, 50)}`);
                console.log(`    Investment: R$ ${c.investment}, Leads: ${c.leads}`);
            });
        }
        console.log('');

        // Check metrics
        const { data: metrics } = await supabase.from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .order('date', { ascending: false })
            .limit(5);

        console.log(`Meta Ads Metrics: ${metrics?.length || 0}`);
        if (metrics && metrics.length > 0) {
            metrics.forEach(m => {
                console.log(`  ${m.date} - ${m.label}`);
                console.log(`    Spend: R$ ${m.spend}, Leads: ${m.cardsCreated}`);
            });
        }
        console.log('');

        // Check integration last sync
        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', company.id)
            .eq('type', 'meta_ads')
            .single();

        console.log('Integration Last Sync:', integration?.lastSync || 'null');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkApolarAfterSync();
