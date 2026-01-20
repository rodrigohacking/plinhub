require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function simulateApiCall() {
    try {
        console.log('Simulating API call for Apolar dashboard...\n');

        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Company:', company.name);
        console.log('Company ID:', company.id);
        console.log('');

        // Simulate what the /api/metrics/unified endpoint would return
        const tag = 'all'; // For Geral tab

        // Get current month date range (as shown in screenshot: "Mês Atual")
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const startDate = startOfMonth.toISOString();
        const endDate = endOfMonth.toISOString();

        console.log('Date Range (Mês Atual):');
        console.log('  Start:', startDate.split('T')[0]);
        console.log('  End:', endDate.split('T')[0]);
        console.log('');

        // Fetch Meta Ads metrics
        const { data: metaMetrics } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'meta_ads')
            .gte('date', startDate)
            .lte('date', endDate);

        console.log(`Meta Ads metrics found: ${metaMetrics?.length || 0}`);

        if (metaMetrics && metaMetrics.length > 0) {
            metaMetrics.forEach(m => {
                console.log(`  ${m.date} - ${m.label}: Spend R$ ${m.spend}, Leads ${m.cardsCreated}`);
            });
        }
        console.log('');

        // Filter by tag
        const filteredMeta = tag === 'all'
            ? metaMetrics?.filter(m => m.label === 'all') || []
            : metaMetrics?.filter(m => m.label === tag) || [];

        console.log(`Filtered Meta metrics (tag="${tag}"): ${filteredMeta.length}`);

        const metaTotal = filteredMeta.reduce((acc, m) => ({
            spend: acc.spend + (m.spend || 0),
            leads: acc.leads + (m.cardsCreated || 0)
        }), { spend: 0, leads: 0 });

        console.log('Meta Ads Total:');
        console.log(`  Spend: R$ ${metaTotal.spend.toFixed(2)}`);
        console.log(`  Leads: ${metaTotal.leads}`);
        console.log(`  CPL: R$ ${metaTotal.leads > 0 ? (metaTotal.spend / metaTotal.leads).toFixed(2) : '0.00'}`);
        console.log('');

        // Fetch Pipefy metrics
        const { data: pipefyMetrics } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'pipefy')
            .gte('date', startDate)
            .lte('date', endDate);

        console.log(`Pipefy metrics found: ${pipefyMetrics?.length || 0}`);

        const pipefyTotal = (pipefyMetrics || []).reduce((acc, m) => ({
            created: acc.created + (m.cardsCreated || 0),
            converted: acc.converted + (m.cardsConverted || 0)
        }), { created: 0, converted: 0 });

        console.log('Pipefy Total:');
        console.log(`  Leads Created: ${pipefyTotal.created}`);
        console.log(`  Sales Closed: ${pipefyTotal.converted}`);
        console.log('');

        console.log('=== DASHBOARD SHOULD SHOW ===');
        console.log(`Investment: R$ ${metaTotal.spend.toFixed(2)}`);
        console.log(`Leads: ${metaTotal.leads}`);
        console.log(`Sales: ${pipefyTotal.converted}`);
        console.log(`CPL: R$ ${metaTotal.leads > 0 ? (metaTotal.spend / metaTotal.leads).toFixed(2) : '0.00'}`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

simulateApiCall();
