const supabase = require('../utils/supabase'); // Changed from prisma
const { decrypt } = require('../utils/encryption');
const metaAdsService = require('./metaAds.service');
const pipefyService = require('./pipefy.service');

class SyncService {
    /**
     * Sync all metrics for a company
     */
    async syncCompanyMetrics(companyIdInput) {
        let companyId = companyIdInput;

        // Verify if it's a UUID or if we need to search by name
        // Simple check: if it lacks hyphens, assumes it might be a name search string 
        // (unless it's a perfectly formatted UUID without hyphens, but standard is with hyphens)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyIdInput);

        if (!isUuid) {
            // Try to find by name
            const { data: company } = await supabase.from('Company')
                .select('id')
                .ilike('name', `%${companyIdInput}%`)
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

        // Get company name for campaign filtering
        const { data: company } = await supabase
            .from('Company')
            .select('name')
            .eq('id', companyId)
            .single();

        const companyName = company?.name || null;

        // Get last 90 days (Increased to fix historical data visibility)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        // Fetch daily insights for the last 90 days
        const dailyInsights = await metaAdsService.getDailyInsights(
            adAccountId,
            accessToken,
            {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        );

        if (!dailyInsights || dailyInsights.length === 0) {
            console.log(`[SyncService] No daily insights for company ${companyId}`);
            return { success: true };
        }

        // Aggregate by date (Meta might return multiple rows per date if multiple campaigns exist)
        const metricsByDate = {};
        dailyInsights.forEach(row => {
            const date = row.date;
            if (!metricsByDate[date]) {
                metricsByDate[date] = {
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                    reach: 0
                };
            }
            metricsByDate[date].spend += row.spend;
            metricsByDate[date].impressions += row.impressions;
            metricsByDate[date].clicks += row.clicks;
            metricsByDate[date].conversions += row.leads; // Map "leads" to "conversions" field in Metric table
            metricsByDate[date].reach += row.reach;
        });

        // Save specifically for "META ADS" tag for each date
        // Note: No longer saving "all" label to avoid double counting in global sums.
        const targetLabel = 'META ADS';
        let insertedCount = 0;
        
        for (const dateStr of Object.keys(metricsByDate)) {
            const metricData = metricsByDate[dateStr];
            
            const payload = {
                companyId,
                source: 'meta_ads',
                date: dateStr,
                label: targetLabel,
                ...metricData
            };
            const { error } = await supabase.from('Metric').upsert(payload, { onConflict: 'companyId,date,source,label' });
            if (error) {
                console.error(`[SyncService] Meta Ads upsert failed for ${dateStr}:`, error.message);
                await this.logSync(companyId, 'meta_ads', 'error', `Metric upsert failed for ${dateStr}: ${error.message}`);
            } else {
                insertedCount++;
            }
        }

        if (insertedCount > 0) {
            console.log(`[SyncService] Inserted/Updated ${insertedCount} metric rows for Meta Ads.`);
        }

        // Update integration lastSync
        await supabase.from('Integration').update({ lastSync: new Date() }).eq('id', integration.id);

        await this.logSync(companyId, 'meta_ads', 'success', 'Metrics synced successfully', insertedCount);

        // --- Sync Campaign Data (Daily Breakdown) ---
        try {
            console.log(`Syncing campaigns for company ${companyId}...`);

            // 1. Delete old campaign records for this period (to avoid duplicates)
            const { error: deleteError } = await supabase
                .from('campaigns')
                .delete()
                .eq('company_id', companyId)
                .gte('start_date', startDate.toISOString())
                .lte('start_date', endDate.toISOString());

            if (deleteError) {
                console.error("Error cleaning old campaigns:", deleteError);
            }

            // 2. Fetch daily campaign insights WITH COMPANY NAME FILTER
            const campaignInsights = await metaAdsService.getCampaignInsights(
                adAccountId,
                accessToken,
                {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                },
                [], // filtering
                null // Pass company name for filtering
            );

            // 3. Insert new campaign records
            if (campaignInsights.length > 0) {
                const campaignRows = campaignInsights.map(c => ({
                    company_id: companyId,
                    name: c.campaign_name,
                    investment: c.spend,
                    clicks: c.clicks,
                    impressions: c.impressions,
                    leads: c.leads,
                    conversions: c.conversions,
                    start_date: c.date,
                    end_date: c.date, // Daily stats, so start=end
                    channel: 'meta_ads'
                }));

                const { error: insertError } = await supabase
                    .from('campaigns')
                    .insert(campaignRows);

                if (insertError) {
                    throw new Error(`Campaign insert failed: ${insertError.message}`);
                }

                console.log(`Synced ${campaignRows.length} campaign records.`);
            }
        } catch (campError) {
            console.error("Campaign sync error:", campError);
            // Log warning but don't fail the main sync (account level worked)
            await this.logSync(companyId, 'meta_ads', 'warning', `Campaign sync error: ${campError.message}`);
        }

        return { success: true };
    }

    /**
     * Sync Pipefy metrics
     */
    async syncPipefy(companyId, integration, daysToSync = 180) {
        const token = decrypt(integration.pipefyToken);
        const pipeId = integration.pipefyPipeId;

        // Get dynamic range (Default to 180 days for full sync, or less for incremental)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysToSync);


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

            const payloads = tagKeys.map(tag => {
                const tagMetrics = dayTags[tag];
                return {
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
            });

            if (payloads.length > 0) {
                const { error } = await supabase.from('Metric').upsert(payloads, { onConflict: 'companyId,date,source,label' });
                if (error) console.error(`[PipefySync] Bulk upsert error for ${dateStr}:`, error.message);
            }
        }

        // Also save the CURRENT PIPELINE STATE (Phases) to TODAY's record
        // Note: No longer saving "all" label to avoid double counting.
        const aggregateTags = Object.keys(metrics.metricsByTag).filter(t => t !== 'all');
        const todayPayloads = aggregateTags.map(tag => {
            const agg = metrics.metricsByTag[tag];
            return {
                companyId,
                source: 'pipefy',
                date: todayTimestamp,
                label: tag,
                cardsByPhase: JSON.stringify(agg.cardsByPhase)
            };
        });

        if (todayPayloads.length > 0) {
            // Note: This upsert might overwrite counts if not careful, 
            // but since we just synced counts in the loop above for TODAY, it's safe.
            const { error } = await supabase.from('Metric').upsert(todayPayloads, { onConflict: 'companyId,date,source,label' });
            if (error) console.error("[PipefySync] Error updating phases:", error.message);
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

    /**
     * Handle single card update from Webhook (Incremental)
     */
    async processPipefyWebhookCard(companyId, cardPayload) {
        console.log(`[SyncService] Incremental update for card ${cardPayload.id} (Company: ${companyId})`);

        // Strategy: Instead of complex delta logic, we simply trigger a 5-day sync
        // for this company to ensure the table is consistent around this card's date.
        // This is safe, fast (compared to 180 days), and highly accurate.

        const { data: integration } = await supabase
            .from('Integration')
            .select('*')
            .eq('companyId', companyId)
            .eq('type', 'pipefy')
            .eq('isActive', true)
            .single();

        if (integration) {
            // Sync only the last 7 days to capture current movements
            return this.syncPipefy(companyId, integration, 7);
        }
    }
}

module.exports = new SyncService();
