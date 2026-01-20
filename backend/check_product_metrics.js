require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function checkProductMetrics() {
    try {
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Checking product-specific metrics for Andar Seguros\n');

        const products = ['condominial', 'rc_sindico', 'automovel', 'residencial'];

        for (const product of products) {
            console.log(`=== ${product.toUpperCase()} ===\n`);

            // Meta Ads
            const { data: metaMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'meta_ads')
                .eq('label', product)
                .order('date', { ascending: false })
                .limit(5);

            console.log(`Meta Ads metrics: ${metaMetrics?.length || 0}`);
            if (metaMetrics && metaMetrics.length > 0) {
                metaMetrics.forEach(m => {
                    console.log(`  ${m.date}: Spend R$ ${m.spend || 0}, Leads ${m.leads || 0}`);
                });
            }
            console.log('');

            // Pipefy
            const { data: pipefyMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'pipefy')
                .eq('label', product)
                .order('date', { ascending: false })
                .limit(5);

            console.log(`Pipefy metrics: ${pipefyMetrics?.length || 0}`);
            if (pipefyMetrics && pipefyMetrics.length > 0) {
                pipefyMetrics.forEach(m => {
                    console.log(`  ${m.date}: Created ${m.cardsCreated || 0}, Converted ${m.cardsConverted || 0}`);
                });
            }
            console.log('\n');
        }

        // Now test aggregation for last 30 days
        console.log('=== AGGREGATION TEST (Last 30 days) ===\n');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();

        for (const product of products) {
            const { data: metaMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'meta_ads')
                .eq('label', product)
                .gte('date', startDateStr)
                .lte('date', endDateStr);

            const { data: pipefyMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'pipefy')
                .eq('label', product)
                .gte('date', startDateStr)
                .lte('date', endDateStr);

            const metaTotal = (metaMetrics || []).reduce((acc, m) => ({
                spend: acc.spend + (m.spend || 0),
                leads: acc.leads + (m.leads || 0)
            }), { spend: 0, leads: 0 });

            const pipefyTotal = (pipefyMetrics || []).reduce((acc, m) => ({
                created: acc.created + (m.cardsCreated || 0),
                converted: acc.converted + (m.cardsConverted || 0)
            }), { created: 0, converted: 0 });

            console.log(`${product}:`);
            console.log(`  Meta: R$ ${metaTotal.spend.toFixed(2)} / ${metaTotal.leads} leads`);
            console.log(`  Pipefy: ${pipefyTotal.created} created / ${pipefyTotal.converted} converted`);
        }

        // Total for Geral
        console.log('\n=== GERAL (Sum of 4 products) ===\n');

        let totalMeta = { spend: 0, leads: 0 };
        let totalPipefy = { created: 0, converted: 0 };

        for (const product of products) {
            const { data: metaMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'meta_ads')
                .eq('label', product)
                .gte('date', startDateStr)
                .lte('date', endDateStr);

            const { data: pipefyMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'pipefy')
                .eq('label', product)
                .gte('date', startDateStr)
                .lte('date', endDateStr);

            (metaMetrics || []).forEach(m => {
                totalMeta.spend += m.spend || 0;
                totalMeta.leads += m.leads || 0;
            });

            (pipefyMetrics || []).forEach(m => {
                totalPipefy.created += m.cardsCreated || 0;
                totalPipefy.converted += m.cardsConverted || 0;
            });
        }

        console.log(`Total Investment: R$ ${totalMeta.spend.toFixed(2)}`);
        console.log(`Total Leads: ${totalMeta.leads}`);
        console.log(`Total Created: ${totalPipefy.created}`);
        console.log(`Total Converted: ${totalPipefy.converted}`);
        console.log(`CPL: R$ ${totalMeta.leads > 0 ? (totalMeta.spend / totalMeta.leads).toFixed(2) : '0.00'}`);

        // Calculate ROI (assuming R$ 1000 per sale)
        const salesVolume = totalPipefy.converted * 1000;
        const roi = totalMeta.spend > 0 ? ((salesVolume - totalMeta.spend) / totalMeta.spend) * 100 : 0;
        console.log(`ROI (estimated): ${roi.toFixed(2)}%`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkProductMetrics();
