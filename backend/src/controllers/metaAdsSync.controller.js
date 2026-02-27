/**
 * MetaAdsSync Controller
 * ----------------------
 * Orchestrates the fetch → normalize → bulk UPSERT pipeline for Meta Ads data.
 *
 * Responsibilities:
 *   1. Define the date range to sync.
 *   2. Call MetaAdsService.getDailyInsights() to get raw rows per campaign/day.
 *   3. Map rows to the Supabase `campaigns` table schema.
 *   4. Execute an idempotent bulk UPSERT — conflicts on (company_id, campaign_id, date)
 *      update all numeric columns in place, never duplicate rows.
 *   5. Return { success, rowsUpserted } — safe for CRON and HTTP routes alike.
 *
 * Intentionally does NOT compute CTR, CPL, ROAS, etc.
 * Those are delegated to the SQL View `get_metrics_summary` in Supabase.
 */

const metaAdsService = require('../services/metaAds.service');
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a YYYY-MM-DD string from a Date object using local parts
 * (avoids UTC-shift artefacts on .toISOString() near midnight).
 */
function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Map a normalized row from MetaAdsService into the `campaigns` table shape.
 */
function toCampaignRow(companyId, row) {
    return {
        company_id: companyId,
        // campaign_id is the surrogate from Meta — we rely on it for the unique constraint
        campaignId: row.campaign_id || null,
        name: row.campaign_name || 'Unknown',
        channel: 'meta_ads',
        start_date: row.date || null,   // daily row: start === end
        end_date: row.date_stop || row.date || null,
        investment: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        leads: row.leads         // strictly on_facebook_lead — see MetaAdsService
        // conversions intentionally omitted; computed by SQL View
    };
}

// ---------------------------------------------------------------------------
// Core function — callable from HTTP routes, CRON jobs, or Webhooks
// ---------------------------------------------------------------------------

/**
 * Sync daily Meta Ads metrics for a given company and ad account.
 *
 * @param {string}  companyId    - UUID of the Company in Supabase.
 * @param {string}  accountId    - Meta Ad Account ID (with or without `act_` prefix).
 * @param {string}  accessToken  - Decrypted Meta access token.
 * @param {number}  [daysToSync=7] - How many days back to sync (7 = last week).
 * @param {string|null} [companyName=null] - Optional name for campaign name filtering.
 * @returns {{ success: boolean, rowsUpserted: number }}
 */
async function syncDailyMetrics(companyId, accountId, accessToken, daysToSync = 7, companyName = null) {
    // Force America/Sao_Paulo timezone for date calculations
    // This ensures we always capture today's data even late at night
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const startBR = new Date(nowBR);
    startBR.setDate(startBR.getDate() - daysToSync);

    const dateRange = {
        startDate: toDateStr(startBR),
        endDate: toDateStr(nowBR) // inclusive — captures all of today in BRT
    };

    console.log(`[MetaAdsSync] Syncing company ${companyId} | ${dateRange.startDate} → ${dateRange.endDate}`);

    // 1. Fetch raw daily rows from Meta Ads API
    const rows = await metaAdsService.getDailyInsights(accountId, accessToken, dateRange, { companyName });

    if (!rows || rows.length === 0) {
        console.log('[MetaAdsSync] No rows returned from Meta Ads API.');
        return { success: true, rowsUpserted: 0 };
    }

    // 2. Map to Supabase schema
    const campaignRows = rows.map(row => toCampaignRow(companyId, row));

    // 3. Bulk UPSERT — idempotent on (company_id, campaignId, start_date)
    //    If the row already exists for this company+campaign+day, ONLY the
    //    numeric columns are updated in-place. No duplicate rows ever created.
    const { data, error } = await supabase
        .from('campaigns')
        .upsert(campaignRows, {
            onConflict: 'company_id,campaignId,start_date',
            ignoreDuplicates: false   // false = UPDATE on conflict (true would skip)
        });

    if (error) {
        throw new Error(`[MetaAdsSync] Supabase upsert failed: ${error.message}`);
    }

    const rowsUpserted = campaignRows.length;
    console.log(`[MetaAdsSync] Done — ${rowsUpserted} rows upserted.`);

    return { success: true, rowsUpserted };
}

// ---------------------------------------------------------------------------
// Express route handler — wraps syncDailyMetrics for use in routes/sync.js
// ---------------------------------------------------------------------------

/**
 * POST /api/sync/:companyId/meta
 * Query params: ?days=7  (optional, defaults to 7)
 */
async function handleSyncRequest(req, res) {
    const { companyId } = req.params;
    const daysToSync = parseInt(req.query.days, 10) || 7;

    try {
        // Resolve the integration for this company
        const { data: integration, error: intError } = await supabase
            .from('Integration')
            .select('metaAdAccountId, metaAccessToken, metaStatus')
            .eq('companyId', companyId)
            .eq('type', 'meta_ads')
            .eq('isActive', true)
            .single();

        if (intError || !integration) {
            return res.status(404).json({
                success: false,
                error: 'No active Meta Ads integration found for this company.'
            });
        }

        if (integration.metaStatus === 'disabled') {
            return res.status(403).json({
                success: false,
                error: 'Meta Ads integration is currently disabled.'
            });
        }

        if (!integration.metaAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'No access token configured.'
            });
        }

        // Lookup company name (used for campaign name filtering)
        const { data: company } = await supabase
            .from('Company')
            .select('name')
            .eq('id', companyId)
            .single();

        const accessToken = decrypt(integration.metaAccessToken);

        const result = await syncDailyMetrics(
            companyId,
            integration.metaAdAccountId,
            accessToken,
            daysToSync,
            company?.name || null
        );

        // Update lastSync timestamp
        await supabase
            .from('Integration')
            .update({ lastSync: new Date().toISOString() })
            .eq('companyId', companyId)
            .eq('type', 'meta_ads');

        return res.json(result);

    } catch (error) {
        console.error(`[MetaAdsSync] Error for company ${companyId}:`, error.message);

        // Log the failure for observability (non-blocking)
        supabase.from('SyncLog').insert({
            companyId,
            source: 'meta_ads',
            status: 'error',
            message: error.message,
            duration: null
        }).then().catch(() => { }); // fire-and-forget

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// ---------------------------------------------------------------------------
// CRON-safe wrapper — logs outcome and never throws to prevent CRON crash
// ---------------------------------------------------------------------------

/**
 * Safe version of syncDailyMetrics for use inside CRON jobs.
 * Catches all errors, logs them, and resolves with a status object.
 *
 * @param {string} companyId
 * @param {Object} integration  - Raw row from Integration table (token still encrypted).
 * @param {number} [daysToSync=7]
 */
async function runCronSync(companyId, integration, daysToSync = 7) {
    const startTime = Date.now();
    try {
        const accessToken = decrypt(integration.metaAccessToken);

        const { data: company } = await supabase
            .from('Company')
            .select('name')
            .eq('id', companyId)
            .single();

        const result = await syncDailyMetrics(
            companyId,
            integration.metaAdAccountId,
            accessToken,
            daysToSync,
            company?.name || null
        );

        const duration = Date.now() - startTime;

        // Persist success log
        await supabase.from('SyncLog').insert({
            companyId,
            source: 'meta_ads',
            status: 'success',
            message: `Synced ${result.rowsUpserted} rows in ${duration}ms`,
            recordsProcessed: result.rowsUpserted,
            duration
        });

        return { ...result, duration };

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[MetaAdsSync CRON] Failed for company ${companyId}:`, error.message);

        // Persist failure log — non-throwing so CRON continues with next company
        await supabase.from('SyncLog').insert({
            companyId,
            source: 'meta_ads',
            status: 'error',
            message: error.message,
            duration
        }).catch(() => { });

        return { success: false, error: error.message, rowsUpserted: 0, duration };
    }
}

module.exports = {
    syncDailyMetrics,
    handleSyncRequest,
    runCronSync
};
