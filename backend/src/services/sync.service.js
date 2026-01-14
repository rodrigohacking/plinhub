const supabase = require('../utils/supabase'); // Changed from prisma
const { decrypt } = require('../utils/encryption');
const metaAdsService = require('./metaAds.service');
const pipefyService = require('./pipefy.service');

class SyncService {
    /**
     * Sync all metrics for a company
     */
    async syncCompanyMetrics(companyIdInput) {
        let companyId = parseInt(companyIdInput);

        // Resolve company if ID is not found or companyIdInput is a string
        if (isNaN(companyId)) {
            const { data: company } = await supabase.from('Company')
                .select('id')
                .or(`name.ilike.%${companyIdInput}%`)
                .limit(1)
                .single();

            if (company) {
                companyId = company.id;
            } else {
                throw new Error(`Empresa '${companyIdInput}' não encontrada.`);
            }
        }

        console.log(`Starting sync for company ${companyId}...`);
        const startTime = Date.now();

        try {
            const { data: integrations, error } = await supabase
                .from('Integration')
                .select('*')
                .eq('companyId', companyId)
                .eq('isActive', true);

            if (error) throw new Error(error.message);

            const results = {
                metaAds: null,
                pipefy: null
            };

            // Sync Meta Ads
            const metaIntegration = integrations.find(i => i.type === 'meta_ads');
            if (metaIntegration && metaIntegration.metaAccessToken) {
                try {
                    results.metaAds = await this.syncMetaAds(companyId, metaIntegration);
                } catch (error) {
                    console.error(`Meta Ads sync failed for company ${companyId}:`, error);
                    await this.logSync(companyId, 'meta_ads', 'error', error.message);
                }
            }

            // Sync Pipefy
            const pipefyIntegration = integrations.find(i => i.type === 'pipefy');
            if (pipefyIntegration && pipefyIntegration.pipefyToken) {
                try {
                    results.pipefy = await this.syncPipefy(companyId, pipefyIntegration);
                } catch (error) {
                    console.error(`Pipefy sync failed for company ${companyId}:`, error);
                    await this.logSync(companyId, 'pipefy', 'error', error.message);
                }
            }

            const duration = Date.now() - startTime;
            console.log(`Sync completed for company ${companyId} in ${duration}ms`);

            return results;
        } catch (error) {
            console.error(`Sync failed for company ${companyId}:`, error);
            throw error;
        }
    }

    /**
     * Sync Meta Ads metrics
     */
    async syncMetaAds(companyId, integration) {
        const accessToken = decrypt(integration.metaAccessToken);
        const adAccountId = integration.metaAdAccountId;

        // Get last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const insights = await metaAdsService.getInsights(
            adAccountId,
            accessToken,
            {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        );

        const today = new Date().toISOString().split('T')[0];
        const metricData = {
            spend: insights.spend,
            impressions: insights.impressions,
            clicks: insights.clicks,
            conversions: insights.conversions,
            roas: insights.roas,
            cpc: insights.cpc,
            cpm: insights.cpm,
            ctr: insights.ctr,
            reach: insights.reach,
            frequency: insights.frequency
        };

        // Save for "all" and specifically for "META ADS" tag
        const labelsToSave = ['all', 'META ADS'];

        for (const label of labelsToSave) {
            // Prisma Upsert -> Supabase Upsert
            // Note: We need the ID to update, or we rely on a Unique Constraint.
            // Assuming 'Metric_companyId_date_source_label_key' exists, we can just upsert.
            // Since we can't easily rely on constraints being perfectly mapped in Supabase without checking,
            // we'll try to FIND first.

            // Construct find query
            const { data: existing } = await supabase
                .from('Metric')
                .select('id')
                .eq('companyId', companyId)
                .eq('date', today)
                .eq('source', 'meta_ads')
                .eq('label', label)
                .single();

            const payload = {
                companyId,
                source: 'meta_ads',
                date: today, // Date string YYYY-MM-DD or ISO
                label: label,
                ...metricData
            };

            if (existing) {
                payload.id = existing.id;
            }

            const { error } = await supabase.from('Metric').upsert(payload);
            if (error) throw new Error(error.message);
        }

        // Update integration lastSync
        await supabase.from('Integration').update({ lastSync: new Date() }).eq('id', integration.id);

        await this.logSync(companyId, 'meta_ads', 'success', 'Metrics synced successfully', 1);

        return { success: true };
    }

    /**
     * Sync Pipefy metrics
     */
    async syncPipefy(companyId, integration) {
        const token = decrypt(integration.pipefyToken);
        const pipeId = integration.pipefyPipeId;

        // Get last 180 days (6 months) to ensure deep history backfill
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 180);

        const metrics = await pipefyService.getPipeMetrics(
            pipeId,
            token,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        const todayTimestamp = new Date().toISOString().split('T')[0];
        const dates = Object.keys(metrics.dailyMetrics || {});

        for (const dateStr of dates) {
            const dayTags = metrics.dailyMetrics[dateStr];
            const tagKeys = Object.keys(dayTags);

            for (const tag of tagKeys) {
                const tagMetrics = dayTags[tag];

                const { data: existing } = await supabase
                    .from('Metric')
                    .select('id')
                    .eq('companyId', companyId)
                    .eq('date', dateStr)
                    .eq('source', 'pipefy')
                    .eq('label', tag)
                    .single();

                const payload = {
                    companyId,
                    source: 'pipefy',
                    date: dateStr,
                    label: tag,
                    cardsCreated: tagMetrics.cardsCreated,
                    cardsQualified: tagMetrics.cardsQualified,
                    cardsConverted: tagMetrics.cardsConverted,
                    cardsLost: tagMetrics.cardsLost,
                    conversionRate: tagMetrics.conversionRate,
                    cardsByPhase: JSON.stringify(tagMetrics.cardsByPhase)
                };

                if (existing) {
                    payload.id = existing.id;
                }

                await supabase.from('Metric').upsert(payload);
            }
        }

        // Also save the CURRENT PIPELINE STATE (Phases) to TODAY's record
        const aggregateTags = Object.keys(metrics.metricsByTag);
        for (const tag of aggregateTags) {
            const agg = metrics.metricsByTag[tag];

            const { data: existing } = await supabase
                .from('Metric')
                .select('id')
                .eq('companyId', companyId)
                .eq('date', todayTimestamp)
                .eq('source', 'pipefy')
                .eq('label', tag)
                .single();

            const payload = {
                companyId,
                source: 'pipefy',
                date: todayTimestamp,
                label: tag,
                cardsByPhase: JSON.stringify(agg.cardsByPhase),
                // Initialize default values if creating new
                cardsCreated: 0,
                cardsQualified: 0,
                cardsConverted: 0,
                cardsLost: 0
            };

            // If updating, we DON'T want to overwrite the counts we might have set in the loop above?
            // Wait, the loop above iterates dates inclusive of today.
            // So if today exists in 'dates', we already set counts.
            // We just need to ensure cardsByPhase is up to date.

            if (existing) {
                payload.id = existing.id;
                // If existing, we only update cardsByPhase to avoid resetting counts to 0
                const { error } = await supabase
                    .from('Metric')
                    .update({ cardsByPhase: JSON.stringify(agg.cardsByPhase) })
                    .eq('id', existing.id);
                if (error) console.error("Error updating phases:", error);
            } else {
                await supabase.from('Metric').insert(payload);
            }
        }

        // Update integration lastSync
        await supabase.from('Integration').update({ lastSync: new Date() }).eq('id', integration.id);

        await this.logSync(companyId, 'pipefy', 'success', 'Metrics synced successfully', dates.length);

        return { success: true, tags: aggregateTags };
    }

    /**
     * Log sync operation
     */
    async logSync(companyId, source, status, message, recordsProcessed = 0, duration = null) {
        await supabase.from('SyncLog').insert({
            companyId,
            source,
            status,
            message,
            recordsProcessed,
            duration
        });
    }
}

module.exports = new SyncService();
