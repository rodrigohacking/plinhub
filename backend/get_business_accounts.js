require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const axios = require('axios');

async function getAccountsFromBusiness() {
    try {
        console.log('=== BUSCANDO CONTAS DO BUSINESS PORTFOLIO ===\n');

        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        const accessToken = decrypt(integration.metaAccessToken);
        const businessId = '1140349810782087';

        console.log('Business Portfolio ID:', businessId);
        console.log('');

        // Get ad accounts from business
        const url = `https://graph.facebook.com/v21.0/${businessId}/owned_ad_accounts`;

        console.log('Buscando contas de anúncios do portfólio...\n');

        const response = await axios.get(url, {
            params: {
                access_token: accessToken,
                fields: 'id,name,account_id,account_status'
            }
        });

        const accounts = response.data.data;

        console.log(`Contas encontradas: ${accounts.length}\n`);

        if (accounts.length > 0) {
            console.log('=== CONTAS DE ANÚNCIOS NO PORTFÓLIO ===\n');

            const metaAdsService = require('./src/services/metaAds.service');

            // Get current month date range
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startDate = startOfMonth.toISOString().split('T')[0];
            const endDate = now.toISOString().split('T')[0];

            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                console.log(`${i + 1}. ${account.name}`);
                console.log(`   Account ID: ${account.account_id}`);
                console.log(`   Status: ${account.account_status}`);

                try {
                    const campaigns = await metaAdsService.getCampaignInsights(
                        account.account_id,
                        accessToken,
                        { startDate, endDate }
                    );

                    if (campaigns.length > 0) {
                        const total = campaigns.reduce((acc, c) => ({
                            spend: acc.spend + c.spend,
                            leads: acc.leads + c.leads
                        }), { spend: 0, leads: 0 });

                        console.log(`   Investimento (Mês Atual): R$ ${total.spend.toFixed(2)}`);
                        console.log(`   Leads: ${total.leads}`);
                        console.log(`   CPL: R$ ${total.leads > 0 ? (total.spend / total.leads).toFixed(2) : '0.00'}`);

                        // Show campaign names
                        const uniqueNames = [...new Set(campaigns.map(c => c.campaign_name))];
                        console.log(`   Campanhas: ${uniqueNames.length}`);
                        uniqueNames.slice(0, 3).forEach(name => {
                            console.log(`     - ${name}`);
                        });

                        // Check if matches
                        if (Math.abs(total.spend - 1900.85) < 100 || Math.abs(total.leads - 19) < 10) {
                            console.log('   ✅ POSSÍVEL MATCH!');
                        }
                    } else {
                        console.log('   Sem campanhas ativas');
                    }
                } catch (error) {
                    console.log(`   ❌ Erro: ${error.message}`);
                }

                console.log('');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

getAccountsFromBusiness();
