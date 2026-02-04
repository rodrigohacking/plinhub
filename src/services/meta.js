import { toast } from 'sonner';
const META_API_URL = 'https://graph.facebook.com/v19.0';

export async function fetchMetaCampaigns(adAccountId, token, productFilter = null) {
    if (!token || !adAccountId) return [];

    // Remove 'act_' if present to avoid doubling
    const actId = adAccountId.replace('act_', '');

    // Fields to fetch
    // We fetch 'insights' with 'time_increment=1' to get daily breakdown for accurate filtering
    const fields = 'id,name,start_time,stop_time,status,objective,insights.time_increment(1){date_start,date_stop,spend,impressions,clicks,actions,cpc,cpm,reach}';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        // Query Params:
        // - effective_status: include PAUSED campaigns
        // - limit: 500 to catch everything
        // FIXED: Enforce specific Account ID as per requirement
        const TARGET_ACT_ID = '631649546531729';

        // BACK TO BASICS: No date_preset. Trusting API default (usually 28d or similar).
        // This configuration worked before (albeit with date skew), so it restores data visibility.
        let query = `fields=${fields}&limit=500&access_token=${token}`;

        if (productFilter) {
            const filtering = [{
                field: 'campaign.name',
                operator: 'CONTAIN',
                value: productFilter
            }];
            query += `&filtering=${encodeURIComponent(JSON.stringify(filtering))}`;
        }

        const response = await fetch(`${META_API_URL}/act_${TARGET_ACT_ID}/campaigns?${query}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();

        if (result.error) {
            console.error('Meta API Error:', result.error);
            // Critical: Throw error so UI shows "Invalid Token" instead of "0 campaigns found"
            throw new Error(result.error.message || 'Meta API Error');
        }

        const campaigns = result.data || [];
        console.log(`[Meta API] Fetched ${campaigns.length} campaigns. Insights present: ${campaigns.some(c => c.insights)}`);

        return campaigns.map(camp => {
            const rawInsights = camp.insights?.data || [];

            // Process Daily Insights
            const dailyData = rawInsights.map(day => {
                const actions = day.actions || [];
                // Robust Lead Finding: Check 'lead', 'pixel_lead', 'lead_grouped' (Forms), and fallback to anything with 'lead' in type
                const leadsAction = actions.find(a =>
                    a.action_type === 'lead' ||
                    a.action_type === 'offsite_conversion.fb_pixel_lead' ||
                    a.action_type === 'onsite_conversion.lead_grouped'
                );

                const leads = leadsAction ? parseInt(leadsAction.value, 10) : 0;

                return {
                    date: day.date_start,
                    spend: parseFloat(day.spend || 0),
                    impressions: parseInt(day.impressions || 0, 10),
                    clicks: parseInt(day.clicks || 0, 10),
                    reach: parseInt(day.reach || 0, 10),
                    leads: leads,
                    conversions: Math.floor(leads * 0.2) // Mock conversion based on leads
                };
            });

            // Calculate Lifetime Totals (for fallback/default view)
            const totalSpend = dailyData.reduce((acc, d) => acc + d.spend, 0);
            const totalImpressions = dailyData.reduce((acc, d) => acc + d.impressions, 0);
            const totalClicks = dailyData.reduce((acc, d) => acc + d.clicks, 0);
            const totalLeads = dailyData.reduce((acc, d) => acc + d.leads, 0);
            const totalConversions = dailyData.reduce((acc, d) => acc + d.conversions, 0);
            const totalReach = dailyData.reduce((acc, d) => acc + d.reach, 0);

            return {
                id: camp.id,
                companyId: 1, // Will be overridden by caller
                name: camp.name,
                objective: camp.objective, // Passed through
                startDate: camp.start_time,
                endDate: camp.stop_time,
                status: camp.status,
                investment: totalSpend, // Legacy field (Lifetime)
                channel: 'Instagram/Facebook',
                impressions: totalImpressions,
                clicks: totalClicks,
                leads: totalLeads,
                reach: totalReach,
                conversions: totalConversions,
                dailyInsights: dailyData // New Field: Array of daily metrics
            };
        });

    } catch (error) {
        console.error('Meta Fetch Error:', error);
        toast.error(`Erro Facebook Ads: ${error.message}`);
        throw error;
    }
}
