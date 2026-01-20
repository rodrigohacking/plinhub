require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function checkCurrentData() {
    try {
        console.log('Checking current database state for Andar Seguros...\n');

        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Company:', company.name, '- ID:', company.id);
        console.log('');

        // Check metrics
        const { data: metrics } = await supabase.from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .order('date', { ascending: false })
            .limit(20);

        console.log(`Total metrics in DB: ${metrics?.length || 0}\n`);

        if (metrics && metrics.length > 0) {
            console.log('Recent metrics:');
            metrics.forEach(m => {
                console.log(`  ${m.date} - ${m.source} - ${m.label}`);
                console.log(`    Spend: R$ ${m.spend || 0}`);
                console.log(`    Cards Created: ${m.cardsCreated || 0}`);
                console.log(`    Cards Converted: ${m.cardsConverted || 0}`);
                console.log(`    Cards Lost: ${m.cardsLost || 0}`);
                console.log('');
            });
        }

        // Check campaigns table
        const { data: campaigns } = await supabase.from('campaigns')
            .select('*')
            .eq('company_id', company.id)
            .order('start_date', { ascending: false })
            .limit(10);

        console.log(`\nCampaigns in DB: ${campaigns?.length || 0}\n`);

        if (campaigns && campaigns.length > 0) {
            console.log('Recent campaigns:');
            campaigns.forEach(c => {
                console.log(`  ${c.start_date} - ${c.name}`);
                console.log(`    Investment: R$ ${c.investment || 0}`);
                console.log(`    Leads: ${c.leads || 0}`);
                console.log('');
            });
        }

        // Check what the unified endpoint would return
        console.log('\n=== TESTING UNIFIED ENDPOINT ===\n');

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
            .lte('date', endDateStr)
            .order('date', { ascending: false });

        console.log(`Meta Ads metrics found: ${metaMetrics?.length || 0}`);

        // Pipefy metrics
        const { data: pipefyMetrics } = await supabase
            .from('Metric')
            .select('*')
            .eq('companyId', company.id)
            .eq('source', 'pipefy')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('date', { ascending: false });

        console.log(`Pipefy metrics found: ${pipefyMetrics?.length || 0}`);

        // Calculate totals
        const VALID_LABELS = ['condominial', 'rc_sindico', 'automovel', 'residencial'];

        const metaTotal = (metaMetrics || []).reduce((acc, m) => {
            const label = (m.label || '').toLowerCase();
            const isValid = VALID_LABELS.some(vl => label.includes(vl));
            if (!isValid) {
                console.log(`  Skipping Meta metric with label: ${m.label}`);
                return acc;
            }
            return {
                spend: acc.spend + (m.spend || 0),
                impressions: acc.impressions + (m.impressions || 0),
                clicks: acc.clicks + (m.clicks || 0),
                conversions: acc.conversions + (m.conversions || 0)
            };
        }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

        const pipefyTotal = (pipefyMetrics || []).reduce((acc, m) => {
            const label = (m.label || '').toLowerCase();
            const isValid = VALID_LABELS.some(vl => label.includes(vl));
            if (!isValid) {
                console.log(`  Skipping Pipefy metric with label: ${m.label}`);
                return acc;
            }
            return {
                leadsEntered: acc.leadsEntered + (m.cardsCreated || 0),
                leadsQualified: acc.leadsQualified + (m.cardsQualified || 0),
                salesClosed: acc.salesClosed + (m.cardsConverted || 0),
                leadsLost: acc.leadsLost + (m.cardsLost || 0)
            };
        }, { leadsEntered: 0, leadsQualified: 0, salesClosed: 0, leadsLost: 0 });

        console.log('\nAGGREGATED TOTALS (Geral - Last 30 days):');
        console.log('Meta Ads:');
        console.log(`  Spend: R$ ${metaTotal.spend.toFixed(2)}`);
        console.log(`  Clicks: ${metaTotal.clicks}`);
        console.log(`  Conversions: ${metaTotal.conversions}`);
        console.log('');
        console.log('Pipefy:');
        console.log(`  Leads Entered: ${pipefyTotal.leadsEntered}`);
        console.log(`  Leads Qualified: ${pipefyTotal.leadsQualified}`);
        console.log(`  Sales Closed: ${pipefyTotal.salesClosed}`);
        console.log(`  Leads Lost: ${pipefyTotal.leadsLost}`);
        console.log('');

        // Calculate ROI
        const salesVolume = pipefyTotal.salesClosed * 1000; // Assuming R$ 1000 per sale as placeholder
        const roi = metaTotal.spend > 0 ? ((salesVolume - metaTotal.spend) / metaTotal.spend) * 100 : 0;
        console.log(`ROI (estimated): ${roi.toFixed(2)}%`);
        console.log(`  (Using placeholder R$ 1000 per sale)`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkCurrentData();
