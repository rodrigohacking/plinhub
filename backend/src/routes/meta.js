const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/encryption');

const META_API_VERSION = 'v24.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/meta/creatives?companyId=X&since=YYYY-MM-DD&until=YYYY-MM-DD
 *
 * Returns ad-level creatives with thumbnail + performance metrics.
 * Results are cached in meta_creatives_cache for 1 hour to avoid Meta rate limits.
 *
 * Response: { creatives: [...], cached: boolean, fetched_at: ISO string }
 */
router.get('/creatives', async (req, res) => {
    const { companyId, since, until } = req.query;

    if (!companyId || !since || !until) {
        return res.status(400).json({ error: 'companyId, since, and until are required' });
    }

    // 1. Check cache (1-hour TTL)
    const cacheKey = `${companyId}_${since}_${until}`;
    try {
        const { data: cached } = await supabase
            .from('meta_creatives_cache')
            .select('data, fetched_at')
            .eq('cache_key', cacheKey)
            .single();

        if (cached && (Date.now() - new Date(cached.fetched_at).getTime()) < CACHE_TTL_MS) {
            console.log(`[MetaCreatives] Cache HIT for ${cacheKey}`);
            return res.json({
                creatives: cached.data,
                cached: true,
                fetched_at: cached.fetched_at
            });
        }
    } catch (_) {
        // Cache miss — proceed to live fetch
    }

    // 2. Fetch integration credentials
    const { data: integration, error: intErr } = await supabase
        .from('Integration')
        .select('metaAccessToken, metaAdAccountId')
        .eq('companyId', companyId)
        .eq('type', 'meta_ads')
        .single();

    if (intErr || !integration?.metaAccessToken) {
        return res.status(404).json({ error: 'Meta Ads integration not configured for this company.' });
    }

    const accessToken = decrypt(integration.metaAccessToken);
    const rawAccountId = integration.metaAdAccountId || '';
    const actId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
    const timeRange = JSON.stringify({ since, until });

    console.log(`[MetaCreatives] Fetching live for ${actId} | ${since} → ${until}`);

    try {
        // ── STEP 1: Get ads + creative thumbnails ──────────────────────────────
        // NOTE: time_range is NOT a valid param for /ads — only for /insights.
        // We filter activity by the insights join in STEP 4 instead.
        const adsRes = await axios.get(`${META_API_BASE}/${actId}/ads`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,status,creative{id,name,thumbnail_url,image_url}',
                effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED']),
                limit: 500
            }
        });

        const ads = adsRes.data?.data || [];
        console.log(`[MetaCreatives] Ads fetched: ${ads.length}`);

        if (ads.length === 0) {
            await upsertCache(supabase, cacheKey, companyId, []);
            return res.json({ creatives: [], cached: false, fetched_at: new Date().toISOString() });
        }

        // ── STEP 2: Get ad-level insights (metrics) ────────────────────────────
        const insightsRes = await axios.get(`${META_API_BASE}/${actId}/insights`, {
            params: {
                access_token: accessToken,
                fields: 'ad_id,ad_name,spend,impressions,clicks,ctr,actions',
                time_range: timeRange,
                level: 'ad',
                limit: 500
            }
        });

        // Handle Meta pagination (first page only — 500 limit should be enough)
        const insights = insightsRes.data?.data || [];
        console.log(`[MetaCreatives] Insights fetched: ${insights.length}`);

        // ── STEP 3: Build ad → insight lookup map ──────────────────────────────
        const insightMap = {};
        insights.forEach(ins => {
            insightMap[ins.ad_id] = ins;
        });

        // ── STEP 4: Join ads + insights ────────────────────────────────────────
        const creatives = ads
            .map(ad => {
                const ins = insightMap[ad.id];
                if (!ins) return null; // No spend in period → skip

                const spend = parseFloat(ins.spend || 0);
                if (spend === 0 && parseInt(ins.impressions || 0) === 0) return null; // No activity

                // Extract leads from actions array
                const actions = ins.actions || [];
                const leadsAction = actions.find(a =>
                    a.action_type === 'lead' ||
                    a.action_type === 'on_facebook_lead' ||
                    a.action_type === 'onsite_conversion.lead_grouped'
                );
                const leads = parseInt(leadsAction?.value || 0);

                // Extract purchases/conversions if tracked via pixel
                const purchaseAction = actions.find(a =>
                    a.action_type === 'purchase' ||
                    a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                    a.action_type === 'omni_purchase'
                );
                const vendas = parseInt(purchaseAction?.value || 0);

                const creative = ad.creative || {};
                const thumbnail = creative.thumbnail_url || creative.image_url || null;

                return {
                    id: ad.id,
                    name: ad.name || ins.ad_name || 'Sem nome',
                    status: ad.status || 'UNKNOWN',
                    thumbnail_url: thumbnail,
                    spend,
                    impressions: parseInt(ins.impressions || 0),
                    clicks: parseInt(ins.clicks || 0),
                    ctr: parseFloat(ins.ctr || 0),
                    leads,
                    vendas,
                    cpl: leads > 0 ? spend / leads : null
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.leads - a.leads); // Default: most leads first

        // ── STEP 5: Persist to cache ───────────────────────────────────────────
        await upsertCache(supabase, cacheKey, companyId, creatives);

        console.log(`[MetaCreatives] Done — ${creatives.length} creatives returned`);
        return res.json({
            creatives,
            cached: false,
            fetched_at: new Date().toISOString()
        });

    } catch (err) {
        console.error('[MetaCreatives] Meta API error:', err.response?.data || err.message);
        const metaErr = err.response?.data?.error;
        const message = metaErr?.message || err.message;
        return res.status(502).json({ error: `Meta API error: ${message}` });
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function upsertCache(supabase, cacheKey, companyId, data) {
    try {
        await supabase
            .from('meta_creatives_cache')
            .upsert({
                cache_key: cacheKey,
                companyId,
                data,
                fetched_at: new Date().toISOString()
            }, { onConflict: 'cache_key' });
    } catch (err) {
        console.warn('[MetaCreatives] Cache write failed (non-fatal):', err.message);
    }
}

module.exports = router;
