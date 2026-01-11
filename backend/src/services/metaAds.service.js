const axios = require('axios');

const META_API_VERSION = 'v18.0';
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
     * Get insights (metrics) for an ad account
     */
    async getInsights(adAccountId, accessToken, dateRange) {
        const { startDate, endDate } = dateRange;

        try {
            const response = await axios.get(`${META_API_BASE}/${adAccountId}/insights`, {
                params: {
                    access_token: accessToken,
                    time_range: JSON.stringify({
                        since: startDate,
                        until: endDate
                    }),
                    fields: [
                        'spend',
                        'impressions',
                        'clicks',
                        'actions',
                        'cpc',
                        'cpm',
                        'ctr',
                        'reach',
                        'frequency'
                    ].join(','),
                    level: 'account',
                    time_increment: 1 // Daily breakdown
                }
            });

            const insights = response.data.data;

            // Aggregate metrics
            const aggregated = insights.reduce((acc, day) => {
                acc.spend += parseFloat(day.spend || 0);
                acc.impressions += parseInt(day.impressions || 0);
                acc.clicks += parseInt(day.clicks || 0);
                acc.reach += parseInt(day.reach || 0);

                // Extract conversions from actions
                const conversions = day.actions?.find(a => a.action_type === 'offsite_conversion.fb_pixel_purchase');
                if (conversions) {
                    acc.conversions += parseInt(conversions.value || 0);
                }

                return acc;
            }, {
                spend: 0,
                impressions: 0,
                clicks: 0,
                reach: 0,
                conversions: 0
            });

            // Calculate derived metrics
            aggregated.cpc = aggregated.clicks > 0 ? aggregated.spend / aggregated.clicks : 0;
            aggregated.cpm = aggregated.impressions > 0 ? (aggregated.spend / aggregated.impressions) * 1000 : 0;
            aggregated.ctr = aggregated.impressions > 0 ? (aggregated.clicks / aggregated.impressions) * 100 : 0;
            aggregated.frequency = aggregated.reach > 0 ? aggregated.impressions / aggregated.reach : 0;
            aggregated.roas = aggregated.spend > 0 && aggregated.conversions > 0
                ? aggregated.conversions / aggregated.spend
                : 0;

            return aggregated;
        } catch (error) {
            throw new Error(`Failed to fetch insights: ${error.message}`);
        }
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
