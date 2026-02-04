require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');
const { decrypt } = require('../src/utils/encryption');
const metaAdsService = require('../src/services/metaAds.service');

async function debugMetaConnection() {
    console.log("Starting Meta Ads Debugging...");

    try {
        // 1. Get all Meta Ads integrations
        const { data: integrations, error } = await supabase
            .from('Integration')
            .select(`
                id,
                companyId,
                metaAdAccountId,
                metaAccessToken,
                metaAccountName,
                Company (
                    id,
                    name
                )
            `)
            .eq('type', 'meta_ads')
            .eq('isActive', true);

        if (error) {
            console.error("Error fetching integrations:", error);
            return;
        }

        console.log(`Found ${integrations.length} active Meta Ads integrations.`);

        for (const integration of integrations) {
            const companyName = integration.Company?.name || 'Unknown Company';
            console.log(`\n--- Inspecting Company: ${companyName} (${integration.companyId}) ---`);
            console.log(`Ad Account ID: ${integration.metaAdAccountId}`);

            if (!integration.metaAccessToken) {
                console.error("❌ No Access Token found.");
                continue;
            }

            // 2. Decrypt Token
            let accessToken;
            try {
                accessToken = decrypt(integration.metaAccessToken);
                // console.log("Token Decrypted:", accessToken ? "Yes" : "No"); // Don't log the actual token
            } catch (decError) {
                console.error("❌ Token Decryption Failed:", decError.message);
                continue;
            }

            if (!accessToken) {
                console.error("❌ Decrypted token is empty.");
                continue;
            }

            // 3. Test Connection
            try {
                console.log("Testing connection...");
                const connectionResult = await metaAdsService.testConnection(accessToken);
                console.log("✅ Connection Successful!");
                console.log(`   User: ${connectionResult.user?.name} (ID: ${connectionResult.user?.id})`);
                console.log(`   Ad Accounts Accessible: ${connectionResult.accountsCount}`);
            } catch (conError) {
                console.error("❌ Connection Failed:", conError.message);

                // If token is invalid, that's the root cause
                if (conError.message.includes('Invalid access token') || conError.message.includes('Session has expired')) {
                    console.error("   ROOT CAUSE: The Meta Ads Access Token is invalid or expired.");
                }
                continue; // Skip data fetch if connection failed
            }

            // 4. Test Data Fetch (Insights)
            try {
                console.log("Fetching Insights (Last 30 days)...");
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const dateRange = {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                };

                // Test Account Insights
                const accountInsights = await metaAdsService.getInsights(
                    integration.metaAdAccountId,
                    accessToken,
                    dateRange
                );
                console.log("✅ Account Insights Fetched:");
                console.log(`   Spend: ${accountInsights.spend}`);
                console.log(`   Impressions: ${accountInsights.impressions}`);
                console.log(`   Clicks: ${accountInsights.clicks}`);

                // Test Campaign Insights (to check filtering)
                console.log("Fetching Campaign Insights without filtering...");
                const campaigns = await metaAdsService.getCampaignInsights(
                    integration.metaAdAccountId,
                    accessToken,
                    dateRange,
                    [],
                    null // No company name filter first
                );
                console.log(`✅ Fetched ${campaigns.length} campaigns.`);
                if (campaigns.length > 0) {
                    console.log(`   Sample Campaign: "${campaigns[0].campaign_name}" (Spend: ${campaigns[0].spend})`);
                }

                // Test with Filtering (Simulate Sync Logic)
                if (companyName) {
                    console.log(`Testing filtering with company name: "${companyName}"...`);
                    const filteredCampaigns = await metaAdsService.getCampaignInsights(
                        integration.metaAdAccountId,
                        accessToken,
                        dateRange,
                        [],
                        companyName
                    );
                    console.log(`✅ Fetched ${filteredCampaigns.length} filtered campaigns.`);
                    if (campaigns.length > 0 && filteredCampaigns.length === 0) {
                        console.warn("   ⚠️ WARNING: Campaigns exist but were filtered out by company name!");
                        console.warn("      Check if campaign names contain 'APOLAR' or 'ANDAR' based on company name.");
                    }
                }

            } catch (fetchError) {
                console.error("❌ Data Fetch Failed:", fetchError.message);
            }
        }

    } catch (err) {
        console.error("Unexpected Error:", err);
    }
}

debugMetaConnection();
