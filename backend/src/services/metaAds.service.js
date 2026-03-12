const axios = require('axios');

const META_API_VERSION = 'v24.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

class MetaAdsService {
    /**
     * Validate access token
     */
    async validateToken(accessToken) {
        try {
            const response = await axios.get(`${META_API_BASE}/me`, {
                params: { access_token: accessToken }
            });
            return { valid: true, user: response.data };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get user's ad accounts
     */
    async getAdAccounts(accessToken) {
        try {
            const response = await axios.get(`${META_API_BASE}/me/adaccounts`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,account_status,currency,business'
                }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to fetch ad accounts: ${error.message}`);
        }
    }

    /**
     * Get the timezone configured for an ad account.
     * Returns { timezone_name, timezone_offset_hours_utc } or null on failure.
     *
     * We use this to compensate the date range sent to the Insights API:
     * Meta always returns `date_start` in the ad account's timezone, which
     * can differ from BRT (UTC-3). A US/Pacific account (UTC-8) means Meta
     * "today" starts earlier than BRT "today", for example.
     */
    async getAccountTimezone(adAccountId, accessToken) {
        try {
            const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
            const response = await axios.get(`${META_API_BASE}/${actId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'timezone_name,timezone_offset_hours_utc'
                }
            });
            return {
                timezone_name: response.data.timezone_name || 'UTC',
                timezone_offset_hours_utc: response.data.timezone_offset_hours_utc ?? 0
            };
        } catch (error) {
            console.warn(`[MetaAds] Could not fetch account timezone: ${error.message}. Assuming UTC.`);
            return { timezone_name: 'UTC', timezone_offset_hours_utc: 0 };
        }
    }

    /**
     * Calculate how many hours the ad account timezone differs from BRT (UTC-3).
     * Positive = account is ahead of BRT; Negative = account is behind BRT.
     *
     * Example: account in UTC (offset=0) → BRT offsetDiff = 0 - (-3) = +3
     * This means account "today" starts 3h after BRT "today" starts,
     * so when we request `since: BRT_today`, we miss the last 3h of the UTC day.
     */
    getTimezoneOffsetVsBRT(accountOffsetHoursUtc) {
        const BRT_OFFSET = -3; // BRT = UTC-3
        return accountOffsetHoursUtc - BRT_OFFSET; // positive → account is ahead of BRT
    }

    /**
     * Get campaigns for an ad account
     */
    async getCampaigns(adAccountId, accessToken) {
        try {
            const response = await axios.get(`${META_API_BASE}/${adAccountId}/campaigns`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,objective,daily_budget,lifetime_budget',
                    limit: 100
                }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to fetch campaigns: ${error.message}`);
        }
    }

    /**
     * Get account-level raw data (non-aggregated) for database UPSERT.
     * 
     * Returns an array of daily rows per campaign, normalized and ready to be
     * saved on the Metric table. Aggregation (CTR, CPL, etc.) is delegated to
     * the SQL View `get_metrics_summary` in Supabase.
     * 
     * Rules applied here:
     *  - Always respects `since` / `until` from dateRange. No date_preset override.
     *  - Leads = strictly `on_facebook_lead` action_type. If missing, leads = 0.
     *  - No mathematical derivation (no CPC, CTR, ROAS, etc.) computed here.
     */
    async getDailyInsights(adAccountId, accessToken, dateRange, options = {}) {
        const { startDate, endDate } = dateRange;
        const { companyName = null, filtering: extraFilters = [] } = options;

        const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

        console.log(`[MetaAds] getDailyInsights | account: ${actId} | ${startDate} → ${endDate}`);

        // Build filters
        const filters = [...extraFilters];

        // NOTE: No campaign.name filter — each company has its own dedicated
        // ad account, so ALL campaigns in the account belong to this company.
        // The old CONTAIN filter was excluding campaigns with generic names.

        // NO effective_status filter — we want insights for ALL campaigns
        // (active, paused, deleted, archived) that had spend in the time_range.
        // The Graph API returns data for any campaign with activity in the period.

        let params = {
            access_token: accessToken,
            // Always honor the dates requested — no preset override
            time_range: JSON.stringify({ since: startDate, until: endDate }),
            fields: [
                'campaign_id',
                'campaign_name',
                'spend',
                'impressions',
                'clicks',
                'reach',
                'actions',      // Needed for on_facebook_lead extraction
                'date_start',
                'date_stop'
            ].join(','),
            level: 'campaign',
            time_increment: 1,  // Daily breakdown → one row per campaign per day
            limit: 1000,
            filtering: JSON.stringify(filters)
        };

        const allRows = [];
        let url = `${META_API_BASE}/${actId}/insights`;
        let pageCount = 0;
        const MAX_PAGES = 50;

        while (true) {
            if (pageCount >= MAX_PAGES) {
                console.warn(`[MetaAds] Max pages (${MAX_PAGES}) reached for ${actId}. Stopping.`);
                break;
            }

            let response;
            try {
                response = await axios.get(url, { params });
            } catch (err) {
                 console.error(`[MetaAdsService] Axios Error GET ${url}`, err.response ? JSON.stringify(err.response.data) : err.message);
                 throw err;
            }
            const page = response.data?.data;

            if (page) allRows.push(...page);

            const nextUrl = response.data?.paging?.next;
            if (nextUrl && nextUrl !== url) {
                url = nextUrl;
                params = {}; // Next URL already includes all params
                pageCount++;
            } else {
                break;
            }
        }

        console.log(`[MetaAds] Total raw rows fetched: ${allRows.length}`);

        // Normalize rows → pure data, no derived metrics
        return allRows.map(item => this._normalizeRow(item));
    }

    /**
     * Normalize a single raw API row into a clean object for DB storage.
     *
     * Lead extraction rule:
     *   - Priority 1: 'lead' (Generic aggregator / Standard event)
     *   - Priority 2: 'on_facebook_lead' (Native form leads - "Leads (formulário)")
     *   - Priority 3: 'onsite_web_lead' (Another native form variant)
     *   - Fallback: Sum of any action containing 'lead' (excluding aggregators to avoid double count)
     */
    _normalizeRow(item) {
        let leads = 0;

        if (Array.isArray(item.actions)) {
            // 1. Try to find the most specific native lead form actions
            const leadAggregator = item.actions.find(a => a.action_type === 'lead');
            const nativeForm = item.actions.find(a => a.action_type === 'on_facebook_lead');
            const onsiteWeb = item.actions.find(a => a.action_type === 'onsite_web_lead');

            if (leadAggregator) {
                leads = parseInt(leadAggregator.value, 10) || 0;
            } else if (nativeForm) {
                leads = parseInt(nativeForm.value, 10) || 0;
            } else if (onsiteWeb) {
                leads = parseInt(onsiteWeb.value, 10) || 0;
            } else {
                // Last effort: If no standard lead action is found, check for ANY action that includes 'lead'
                // This covers custom conversions or edge cases
                const customLeads = item.actions.filter(a =>
                    a.action_type.toLowerCase().includes('lead') &&
                    !['leads_atendidos', 'leads_perdidos', 'qualified_lead', 'qualified-lead'].includes(a.action_type.toLowerCase())
                );

                if (customLeads.length > 0) {
                    // Get the maximum value among lead-like actions to avoid summing duplicates (like conversion + grouped)
                    leads = Math.max(...customLeads.map(l => parseInt(l.value, 10) || 0));
                }
            }
        }

        // Normalize date: always strip to YYYY-MM-DD only (Meta returns plain dates in account TZ)
        const rawDateStart = item.date_start || null;
        const rawDateStop = item.date_stop || null;
        const normalizeDate = (d) => (d && d.length > 10 ? d.slice(0, 10) : d);

        return {
            campaign_id: item.campaign_id || null,
            campaign_name: item.campaign_name || null,
            date: normalizeDate(rawDateStart),
            date_stop: normalizeDate(rawDateStop),
            spend: parseFloat(item.spend || 0),
            impressions: parseInt(item.impressions || 0, 10),
            clicks: parseInt(item.clicks || 0, 10),
            reach: parseInt(item.reach || 0, 10),
            leads
        };
    }

    /**
     * @deprecated Use getDailyInsights() instead.
     *
     * Kept for backward-compatibility with any route still calling getCampaignInsights().
     * Delegates to the new method and re-maps the response shape.
     */
    async getCampaignInsights(adAccountId, accessToken, dateRange, filtering = [], companyName = null) {
        const rows = await this.getDailyInsights(adAccountId, accessToken, dateRange, {
            companyName,
            filtering
        });

        // Re-map to the legacy shape callers might expect
        return rows.map(r => ({
            campaign_id: r.campaign_id,
            campaign_name: r.campaign_name,
            date: r.date,
            spend: r.spend,
            impressions: r.impressions,
            clicks: r.clicks,
            leads: r.leads,
            conversions: 0 // No longer inferred — let the SQL View compute
        }));
    }

    /**
     * Get account status
     */
    async getAccountStatus(adAccountId, accessToken) {
        try {
            const response = await axios.get(`${META_API_BASE}/${adAccountId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,account_status,disable_reason,currency'
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch account status: ${error.message}`);
        }
    }

    /**
     * Test Meta Ads connection
     */
    async testConnection(accessToken) {
        try {
            const validation = await this.validateToken(accessToken);
            if (!validation.valid) {
                throw new Error('Invalid access token');
            }

            const accounts = await this.getAdAccounts(accessToken);

            return {
                success: true,
                user: validation.user,
                accountsCount: accounts.length,
                accounts: accounts.map(acc => ({
                    id: acc.id,
                    name: acc.name,
                    status: acc.account_status
                }))
            };
        } catch (error) {
            throw new Error(`Meta Ads connection failed: ${error.message}`);
        }
    }
}

module.exports = new MetaAdsService();
