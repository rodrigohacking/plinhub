const { decrypt } = require('./encryption');
const axios = require('axios');

const META_API_URL = 'https://graph.facebook.com/v24.0';

async function fetchLiveMetaCampaigns(adAccountId, encryptedToken, startDateStr, endDateStr) {
    if (!encryptedToken || !adAccountId) return null;
    try {
        const token = decrypt(encryptedToken);
        const actId = adAccountId.replace('act_', '');

        let dateQuery = 'date_preset=maximum';
        if (startDateStr && endDateStr) {
            const startStr = startDateStr.split('T')[0];
            const endStr = endDateStr.split('T')[0];
            const timeRangeObj = { since: startStr, until: endStr };
            dateQuery = `time_range=${encodeURIComponent(JSON.stringify(timeRangeObj))}`;
        }

        const fields = 'id,name,start_time,stop_time,status,objective,insights.time_increment(1).limit(90){date_start,date_stop,spend,impressions,clicks,actions,cpc,cpm,reach}';
        const query = `fields=${fields}&limit=500&${dateQuery}&access_token=${token}`;
        
        const url = `${META_API_URL}/act_${actId}/campaigns?${query}`;
        console.log("Meta API URL:", url.replace(token, 'TOKEN'));
        
        const response = await axios.get(url, { timeout: 15000 });
        const result = response.data;

        if (result.error) throw new Error(result.error.message || 'Meta API Error');

        const campaigns = result.data || [];

        return campaigns.map(camp => {
            const rawInsights = camp.insights?.data || [];

            const dailyData = rawInsights.map(day => {
                const actions = day.actions || [];

                // Priority-based lead extraction (same priority as metaAds.service.js)
                const leadTypes = [
                    'lead',                              // Meta aggregate (most reliable)
                    'on_facebook_lead',                  // Native lead form
                    'onsite_web_lead',                   // Onsite web
                    'offsite_conversion.fb_pixel_lead',  // Pixel conversion
                    'onsite_conversion.lead_grouped',    // Grouped onsite
                ];
                let leads = 0;
                for (const type of leadTypes) {
                    const action = actions.find(a => a.action_type === type);
                    if (action) { leads = parseInt(action.value, 10) || 0; break; }
                }
                // Last resort: any action containing 'lead' (max value)
                if (leads === 0) {
                    const customLeads = actions.filter(a =>
                        a.action_type.toLowerCase().includes('lead')
                    );
                    if (customLeads.length > 0) {
                        leads = Math.max(...customLeads.map(l => parseInt(l.value, 10) || 0));
                    }
                }

                return {
                    date: day.date_start,
                    spend: parseFloat(day.spend || 0),
                    impressions: parseInt(day.impressions || 0, 10),
                    clicks: parseInt(day.clicks || 0, 10),
                    reach: parseInt(day.reach || 0, 10),
                    leads,
                    conversions: 0
                };
            });

            return {
                campaignId: camp.id,
                name: camp.name,
                objective: camp.objective,
                start_date: camp.start_time,
                end_date: camp.stop_time,
                status: camp.status,
                investment: dailyData.reduce((acc, d) => acc + d.spend, 0),
                channel: 'Instagram/Facebook',
                impressions: dailyData.reduce((acc, d) => acc + d.impressions, 0),
                clicks: dailyData.reduce((acc, d) => acc + d.clicks, 0),
                leads: dailyData.reduce((acc, d) => acc + d.leads, 0),
                dailyInsights: dailyData
            };
        });
    } catch (e) {
        console.error("Meta Proxy Error:", e.response ? e.response.data : e.message);
        return null;
    }
}

module.exports = { fetchLiveMetaCampaigns };
