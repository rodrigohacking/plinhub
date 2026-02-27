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

            const response = await axios.get(url, { params });
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
            // DEBUG: Log actions for lead analysis
            const actionTypes = item.actions.map(a => a.action_type);
            console.log(`[MetaDebug] Actions for ${item.campaign_name}:`, actionTypes);
            
            // 1. Try to find the most specific native lead form actions
            const leadAggregator = item.actions.find(a => a.action_type === 'lead');
            const nativeForm = item.actions.find(a => a.action_type === 'on_facebook_lead');
            const onsiteWeb = item.actions.find(a => a.action_type === 'onsite_web_lead');

            if (leadAggregator) {
                console.log(`[MetaDebug] Found 'lead' aggregator: ${leadAggregator.value}`);
                leads = parseInt(leadAggregator.value, 10) || 0;
            } else if (nativeForm) {
                console.log(`[MetaDebug] Found 'on_facebook_lead': ${nativeForm.value}`);
                leads = parseInt(nativeForm.value, 10) || 0;
            } else if (onsiteWeb) {
                console.log(`[MetaDebug] Found 'onsite_web_lead': ${onsiteWeb.value}`);
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
                    console.log(`[MetaDebug] Found custom leads sum: ${leads} (Types: ${customLeads.map(l => l.action_type).join(', ')})`);
                }
            }
        }

        return {
            campaign_id: item.campaign_id || null,
            campaign_name: item.campaign_name || null,
            date: item.date_start || null,
            date_stop: item.date_stop || null,
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
