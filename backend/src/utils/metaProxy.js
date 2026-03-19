const metaAdsService = require('../services/metaAds.service');
const { ensureValidMetaToken } = require('../services/metaToken.service');

function clampDateStr(value) {
    if (!value) return null;
    return value.includes('T') ? value.split('T')[0] : value;
}

function addDays(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function fetchLiveMetaCampaigns(integration, startDateStr, endDateStr) {
    if (!integration || !integration.metaAccessToken || !integration.metaAdAccountId) return null;
    try {
        const { accessToken } = await ensureValidMetaToken(integration);
        if (!accessToken) return null;

        let startStr = clampDateStr(startDateStr) || clampDateStr(endDateStr);
        let endStr = clampDateStr(endDateStr) || clampDateStr(startDateStr);

        if (!startStr || !endStr) return null;

        // Adjust for ad account timezone to avoid missing "today" data
        try {
            const tz = await metaAdsService.getAccountTimezone(integration.metaAdAccountId, accessToken);
            const offsetVsBRT = metaAdsService.getTimezoneOffsetVsBRT(tz.timezone_offset_hours_utc);
            if (offsetVsBRT > 0) {
                endStr = addDays(endStr, 1);
            }
        } catch (e) {
            // Silent fallback to provided dates
        }

        const rows = await metaAdsService.getDailyInsights(
            integration.metaAdAccountId,
            accessToken,
            { startDate: startStr, endDate: endStr }
        );

        if (!rows || rows.length === 0) return [];

        const byCampaign = new Map();

        rows.forEach(r => {
            const id = r.campaign_id || 'unknown';
            if (!byCampaign.has(id)) {
                byCampaign.set(id, {
                    id, // expose as id for UI lookups
                    campaignId: id,
                    name: r.campaign_name || 'Unknown',
                    start_date: r.date || null,
                    end_date: r.date_stop || r.date || null,
                    status: null,
                    investment: 0,
                    channel: 'Instagram/Facebook',
                    impressions: 0,
                    clicks: 0,
                    leads: 0,
                    dailyInsights: []
                });
            }

            const entry = byCampaign.get(id);
            entry.dailyInsights.push({
                date: r.date,
                spend: r.spend,
                impressions: r.impressions,
                clicks: r.clicks,
                reach: r.reach,
                leads: r.leads,
                conversions: 0
            });

            entry.investment += r.spend || 0;
            entry.impressions += r.impressions || 0;
            entry.clicks += r.clicks || 0;
            entry.leads += r.leads || 0;

            if (!entry.start_date || (r.date && r.date < entry.start_date)) entry.start_date = r.date;
            if (!entry.end_date || (r.date_stop && r.date_stop > entry.end_date)) entry.end_date = r.date_stop;
        });

        return Array.from(byCampaign.values());
    } catch (e) {
        console.error("Meta Proxy Error:", e.response ? e.response.data : e.message);
        return null;
    }
}

module.exports = { fetchLiveMetaCampaigns };
