require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');

/**
 * Sync for Apolar - shows ALL campaigns from the Ad Account
 * (no filtering by campaign name since they share the account with Andar)
 */
async function syncApolarAllCampaigns() {
    try {
        console.log('Syncing ALL campaigns for Apolar Condominios...\n');

        const { data: company } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Company:', company.name, '- ID:', company.id);

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', company.id)
            .eq('type', 'meta_ads')
            .single();

        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = integration.metaAdAccountId;

        console.log('Ad Account:', adAccountId);
        console.log('');

        // Date range: last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const dateRange = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };

        console.log(`Syncing from ${dateRange.startDate} to ${dateRange.endDate}\n`);

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
                start_date: c.date,
                end_date: c.date,
                channel: 'meta_ads'
            }));

            await supabase.from('campaigns').insert(campaignRows);
            console.log(`✓ Saved ${campaignRows.length} campaign records\n`);
        }

        // Aggregate ALL campaigns (no filtering)
        const today = new Date().toISOString().split('T')[0];

        const totalMetrics = campaigns.reduce((acc, c) => ({
            spend: acc.spend + c.spend,
            impressions: acc.impressions + c.impressions,
            clicks: acc.clicks + c.clicks,
            cardsCreated: acc.cardsCreated + c.leads,
            conversions: acc.conversions + c.conversions
        }), { spend: 0, impressions: 0, clicks: 0, cardsCreated: 0, conversions: 0 });

        // Calculate derived metrics
        totalMetrics.cpc = totalMetrics.clicks > 0 ? totalMetrics.spend / totalMetrics.clicks : 0;
        totalMetrics.cpm = totalMetrics.impressions > 0 ? (totalMetrics.spend / totalMetrics.impressions) * 1000 : 0;
        totalMetrics.ctr = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions) * 100 : 0;

        // Save aggregated metric with label 'all' (for Geral tab)
        const { data: existing } = await supabase
            .from('Metric')
            .select('id')
            .eq('companyId', company.id)
            .eq('date', today)
            .eq('source', 'meta_ads')
            .eq('label', 'all')
            .single();

        const payload = {
            companyId: company.id,
            source: 'meta_ads',
            date: today,
            label: 'all',
            ...totalMetrics
        };

        if (existing) {
            await supabase.from('Metric').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('Metric').insert(payload);
        }

        console.log('✓ Saved aggregated Meta Ads metrics:');
        console.log(`  Spend: R$ ${totalMetrics.spend.toFixed(2)}`);
        console.log(`  Leads: ${totalMetrics.cardsCreated}`);
        console.log(`  CPL: R$ ${totalMetrics.cardsCreated > 0 ? (totalMetrics.spend / totalMetrics.cardsCreated).toFixed(2) : '0.00'}`);
        console.log('');

        // Update last sync
        await supabase
            .from('Integration')
            .update({ lastSync: new Date().toISOString() })
            .eq('id', integration.id);

        console.log('✓ Sync completed successfully!');

    } catch (error) {
        console.error('Sync error:', error.message);
        console.error('Stack:', error.stack);
    }
}

syncApolarAllCampaigns();
