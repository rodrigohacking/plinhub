require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');
const pipefyService = require('./src/services/pipefy.service');

/**
 * Enhanced sync that creates product-specific metrics
 */
async function syncAndarWithProducts() {
    try {
        console.log('Starting enhanced sync for Andar Seguros...\n');

        // Find company
        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%andar%')
            .single();

        console.log('Company:', company.name, '- ID:', company.id);

        // Get integrations
        const { data: integrations } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', company.id)
            .eq('isActive', true);

        const metaIntegration = integrations.find(i => i.type === 'meta_ads');
        const pipefyIntegration = integrations.find(i => i.type === 'pipefy');

        if (!metaIntegration || !pipefyIntegration) {
            console.error('Missing integrations');
            return;
        }

        // Date range: last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const dateRange = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };

        console.log(`Syncing from ${dateRange.startDate} to ${dateRange.endDate}\n`);

        // ===== SYNC META ADS =====
        console.log('=== SYNCING META ADS ===\n');

        const accessToken = decrypt(metaIntegration.metaAccessToken);
        const adAccountId = metaIntegration.metaAdAccountId;

        // Get campaign insights
        const campaigns = await metaAdsService.getCampaignInsights(
            adAccountId,
            accessToken,
            dateRange
        );

        console.log(`Fetched ${campaigns.length} campaign records\n`);

        // Delete old campaign records for this period
        await supabase
            .from('campaigns')
            .delete()
            .eq('company_id', company.id)
            .gte('start_date', dateRange.startDate)
            .lte('start_date', dateRange.endDate);

        // Insert new campaign records
        if (campaigns.length > 0) {
            const campaignRows = campaigns.map(c => ({
                company_id: company.id,
                name: c.campaign_name,
                investment: c.spend,
                clicks: c.clicks,
                impressions: c.impressions,
                leads: c.leads,
                conversions: c.conversions,
                start_date: `${c.date}T12:00:00Z`,
                end_date: `${c.date}T12:00:00Z`,
                channel: 'meta_ads'
            }));

            await supabase.from('campaigns').insert(campaignRows);
            console.log(`✓ Saved ${campaignRows.length} campaign records\n`);
        }

        // Aggregate campaigns by product
        const productKeywords = {
            'condominial': ['condominial', 'condominio'],
            'rc_sindico': ['sindico', 'rc sindico'],
            'automovel': ['automovel', 'auto'],
            'residencial': ['residencial']
        };

        const today = new Date().toISOString().split('T')[0];

        // Create product-specific metrics
        for (const [product, keywords] of Object.entries(productKeywords)) {
            const productCampaigns = campaigns.filter(c => {
                const name = c.campaign_name.toUpperCase();
                return keywords.some(k => name.includes(k.toUpperCase()));
            });

            const metrics = productCampaigns.reduce((acc, c) => ({
                spend: acc.spend + c.spend,
                impressions: acc.impressions + c.impressions,
                clicks: acc.clicks + c.clicks,
                cardsCreated: acc.cardsCreated + c.leads, // Use cardsCreated for leads
                conversions: acc.conversions + c.conversions
            }), { spend: 0, impressions: 0, clicks: 0, cardsCreated: 0, conversions: 0 });

            // Calculate derived metrics
            metrics.cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
            metrics.cpm = metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0;
            metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;

            // Check if metric exists
            const { data: existing } = await supabase
                .from('Metric')
                .select('id')
                .eq('companyId', company.id)
                .eq('date', today)
                .eq('source', 'meta_ads')
                .eq('label', product)
                .single();

            const payload = {
                companyId: company.id,
                source: 'meta_ads',
                date: today,
                label: product,
                ...metrics
            };

            if (existing) {
                await supabase.from('Metric').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('Metric').insert(payload);
            }

            console.log(`✓ Saved Meta Ads metrics for ${product}:`);
            console.log(`  Spend: R$ ${metrics.spend.toFixed(2)}, Leads: ${metrics.cardsCreated}, CPL: R$ ${metrics.cardsCreated > 0 ? (metrics.spend / metrics.cardsCreated).toFixed(2) : '0.00'}`);
        }

        console.log('');

        // ===== SYNC PIPEFY =====
        console.log('=== SYNCING PIPEFY ===\n');

        const pipefyToken = decrypt(pipefyIntegration.pipefyToken);
        const pipeId = pipefyIntegration.pipefyPipeId;

        // Get pipe metrics (last 180 days for historical data)
        const pipefyStartDate = new Date();
        pipefyStartDate.setDate(pipefyStartDate.getDate() - 180);

        const pipeMetrics = await pipefyService.getPipeMetrics(
            pipeId,
            pipefyToken,
            pipefyStartDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        console.log(`Fetched Pipefy metrics with ${Object.keys(pipeMetrics.dailyMetrics || {}).length} days\n`);

        // Save daily metrics for each product
        const dates = Object.keys(pipeMetrics.dailyMetrics || {});

        for (const dateStr of dates) {
            const dayTags = pipeMetrics.dailyMetrics[dateStr];

            // Only save product-specific tags
            for (const tag of Object.keys(dayTags)) {
                // Skip if not a product tag
                const normalizedTag = tag.toLowerCase();
                const isProduct = Object.keys(productKeywords).some(p =>
                    normalizedTag.includes(p.replace('_', ' ')) || normalizedTag.includes(p)
                );

                if (!isProduct) continue;

                // Map tag to product label
                let productLabel = tag.toLowerCase();
                if (normalizedTag.includes('sindico')) productLabel = 'rc_sindico';
                else if (normalizedTag.includes('condominial')) productLabel = 'condominial';
                else if (normalizedTag.includes('automovel') || normalizedTag.includes('auto')) productLabel = 'automovel';
                else if (normalizedTag.includes('residencial')) productLabel = 'residencial';

                const tagMetrics = dayTags[tag];

                const { data: existing } = await supabase
                    .from('Metric')
                    .select('id')
                    .eq('companyId', company.id)
                    .eq('date', dateStr)
                    .eq('source', 'pipefy')
                    .eq('label', productLabel)
                    .single();

                const payload = {
                    companyId: company.id,
                    source: 'pipefy',
                    date: dateStr,
                    label: productLabel,
                    cardsCreated: tagMetrics.cardsCreated,
                    cardsQualified: tagMetrics.cardsQualified,
                    cardsConverted: tagMetrics.cardsConverted,
                    cardsLost: tagMetrics.cardsLost,
                    conversionRate: tagMetrics.conversionRate,
                    cardsByPhase: JSON.stringify(tagMetrics.cardsByPhase)
                };

                if (existing) {
                    await supabase.from('Metric').update(payload).eq('id', existing.id);
                } else {
                    await supabase.from('Metric').insert(payload);
                }
            }
        }

        console.log(`✓ Saved Pipefy metrics for ${dates.length} days\n`);

        // Show summary
        console.log('=== SYNC SUMMARY ===\n');

        for (const product of Object.keys(productKeywords)) {
            const { data: metaMetric } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'meta_ads')
                .eq('label', product)
                .eq('date', today)
                .single();

            const { data: pipefyMetrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', company.id)
                .eq('source', 'pipefy')
                .eq('label', product)
                .gte('date', dateRange.startDate)
                .lte('date', today);

            const pipefyTotal = (pipefyMetrics || []).reduce((acc, m) => ({
                created: acc.created + (m.cardsCreated || 0),
                converted: acc.converted + (m.cardsConverted || 0),
                lost: acc.lost + (m.cardsLost || 0)
            }), { created: 0, converted: 0, lost: 0 });

            console.log(`${product.toUpperCase()}:`);
            console.log(`  Meta Ads: R$ ${metaMetric?.spend || 0} / ${metaMetric?.cardsCreated || 0} leads`);
            console.log(`  Pipefy: ${pipefyTotal.created} created / ${pipefyTotal.converted} converted / ${pipefyTotal.lost} lost`);
            console.log('');
        }
        console.log('✓ Sync completed successfully!');

    } catch (error) {
        console.error('Sync error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

syncAndarWithProducts();
