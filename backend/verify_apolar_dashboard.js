require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function verifyApolarDashboardData() {
    try {
        console.log('Verifying Apolar dashboard data...\n');

        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Company:', company.name);
        console.log('');

        // Check what the dashboard would show
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();

        // Meta Ads metrics
        const { data: metaMetrics } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .gte('date', startDateStr)
            .lte('date', endDateStr);

        console.log(`Meta Ads metrics found: ${metaMetrics?.length || 0}\n`);

        if (metaMetrics && metaMetrics.length > 0) {
            console.log('Meta Ads metrics:');
            metaMetrics.forEach(m => {
                console.log(`  ${m.date} - Label: ${m.label}`);
                console.log(`    Spend: R$ ${m.spend || 0}`);
                console.log(`    Leads (cardsCreated): ${m.cardsCreated || 0}`);
                console.log('');
            });

            // Calculate total for "all" label (Geral tab)
            const allMetrics = metaMetrics.filter(m => m.label === 'all');
            const totalSpend = allMetrics.reduce((sum, m) => sum + (m.spend || 0), 0);
            const totalLeads = allMetrics.reduce((sum, m) => sum + (m.cardsCreated || 0), 0);

            console.log('GERAL TAB (label="all"):');
            console.log(`  Investment: R$ ${totalSpend.toFixed(2)}`);
            console.log(`  Leads: ${totalLeads}`);
            console.log(`  CPL: R$ ${totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00'}`);
        } else {
            console.log('❌ No Meta Ads metrics found!');
        }

        console.log('\n');

        // Check campaigns
        const { data: campaigns } = await supabase.from('campaigns')
            .select('*')
            .eq('company_id', company.id)
            .order('start_date', { ascending: false })
            .limit(5);

        console.log(`Campaigns: ${campaigns?.length || 0}`);
        if (campaigns && campaigns.length > 0) {
            console.log('Recent campaigns:');
            campaigns.forEach(c => {
                console.log(`  ${c.start_date} - ${c.name.substring(0, 50)}`);
                console.log(`    Investment: R$ ${c.investment}, Leads: ${c.leads}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

verifyApolarDashboardData();
