const prisma = require('../utils/prisma');
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
            const company = await prisma.company.findFirst({
                where: { name: { contains: String(companyIdInput) } }
            });
            if (company) {
                companyId = company.id;
            } else {
                throw new Error(`Empresa '${companyIdInput}' não encontrada.`);
            }
        }

        console.log(`Starting sync for company ${companyId}...`);
        const startTime = Date.now();

        try {
            const integrations = await prisma.integration.findMany({
                where: {
                    companyId,
                    isActive: true
                }
            });

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
            await prisma.metric.upsert({
                where: {
                    companyId_date_source_label: {
                        companyId,
                        date: new Date(today),
                        source: 'meta_ads',
                        label: label
                    }
                },
                update: metricData,
                create: {
                    companyId,
                    source: 'meta_ads',
                    date: new Date(today),
                    label: label,
                    ...metricData
                }
            });
        }

        // Update integration lastSync
        await prisma.integration.update({
            where: { id: integration.id },
            data: { lastSync: new Date() }
        });

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

        // Process DAILY metrics
        // We iterate over the dates returned by the service
        const dates = Object.keys(metrics.dailyMetrics || {});

        // If no daily metrics found, we still might want to update "today" with snapshot
        // But normally if we have cards, we have dates.

        for (const dateStr of dates) {
            const dayTags = metrics.dailyMetrics[dateStr];
            const tagKeys = Object.keys(dayTags);

            for (const tag of tagKeys) {
                const tagMetrics = dayTags[tag];

                // For historical days, we might not have 'cardsByPhase' snapshot as it's a current state thing
                // But our service implementation doesn't strictly separate snapshot vs history well for phase counts.
                // However, for the dashboard 'Won/Lost' counts, we rely on the daily increments.
                // The 'cardsByPhase' is usually used for "Current Pipeline Status".
                // So we should save 'cardsByPhase' only to the LATEST date (today), or keep it null for historical.
                // The service returns empty cardsByPhase for daily buckets (except 'all' maybe?).
                // My service code: `metricsByTag[t].cardsByPhase` was populated for Aggregate, NOT for daily (except initialized empty).
                // So daily records won't have phases. That's fine.

                await prisma.metric.upsert({
                    where: {
                        companyId_date_source_label: {
                            companyId,
                            date: new Date(dateStr),
                            source: 'pipefy',
                            label: tag
                        }
                    },
                    update: {
                        cardsCreated: tagMetrics.cardsCreated,
                        cardsQualified: tagMetrics.cardsQualified,
                        cardsConverted: tagMetrics.cardsConverted,
                        cardsLost: tagMetrics.cardsLost,
                        conversionRate: tagMetrics.conversionRate,
                        // Update phases only if present (likely only for Aggregate logic, but let's leave as is)
                        // cardsByPhase: JSON.stringify(tagMetrics.cardsByPhase) 
                    },
                    create: {
                        companyId,
                        source: 'pipefy',
                        date: new Date(dateStr),
                        label: tag,
                        cardsCreated: tagMetrics.cardsCreated,
                        cardsQualified: tagMetrics.cardsQualified,
                        cardsConverted: tagMetrics.cardsConverted,
                        cardsLost: tagMetrics.cardsLost,
                        conversionRate: tagMetrics.conversionRate,
                        cardsByPhase: JSON.stringify(tagMetrics.cardsByPhase)
                    }
                });
            }
        }

        // Also save the CURRENT PIPELINE STATE (Phases) to TODAY's record (using the aggregate 'metricsByTag')
        // so that "Current Pipeline" charts work.
        const aggregateTags = Object.keys(metrics.metricsByTag);
        for (const tag of aggregateTags) {
            const agg = metrics.metricsByTag[tag];
            // We only care about updating the 'cardsByPhase' for today
            await prisma.metric.upsert({
                where: {
                    companyId_date_source_label: {
                        companyId,
                        date: new Date(todayTimestamp),
                        source: 'pipefy',
                        label: tag
                    }
                },
                update: {
                    cardsByPhase: JSON.stringify(agg.cardsByPhase)
                },
                create: {
                    companyId,
                    source: 'pipefy',
                    date: new Date(todayTimestamp),
                    label: tag,
                    cardsCreated: 0, // Don't double count daily metrics if they are already in the loop above
                    cardsQualified: 0,
                    cardsConverted: 0,
                    cardsLost: 0,
                    cardsByPhase: JSON.stringify(agg.cardsByPhase)
                }
            });
        }

        // Update integration lastSync
        await prisma.integration.update({
            where: { id: integration.id },
            data: { lastSync: new Date() }
        });

        await this.logSync(companyId, 'pipefy', 'success', 'Metrics synced successfully', dates.length);

        return { success: true, tags: aggregateTags };
    }

    /**
     * Log sync operation
     */
    async logSync(companyId, source, status, message, recordsProcessed = 0, duration = null) {
        await prisma.syncLog.create({
            data: {
                companyId,
                source,
                status,
                message,
                recordsProcessed,
                duration
            }
        });
    }
}

module.exports = new SyncService();
