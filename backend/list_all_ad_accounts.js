require('dotenv').config();
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/encryption');
const metaAdsService = require('./src/services/metaAds.service');

async function listAllAdAccounts() {
    try {
        console.log('=== LISTANDO TODAS AS CONTAS DE ANÚNCIOS ACESSÍVEIS ===\n');

        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Company:', apolar.name);
        console.log('');

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        const accessToken = decrypt(integration.metaAccessToken);

        console.log('Buscando contas de anúncios acessíveis com o token da Apolar...\n');

        // Test connection to get all accounts
        const connection = await metaAdsService.testConnection(accessToken);

        console.log('✓ Conexão bem-sucedida!');
        console.log('User:', connection.user.name);
        console.log('');
        console.log(`Total de contas encontradas: ${connection.accountsCount}\n`);

        if (connection.accounts && connection.accounts.length > 0) {
            console.log('=== CONTAS DE ANÚNCIOS DISPONÍVEIS ===\n');

            // Fetch data for current month for each account
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startDate = startOfMonth.toISOString().split('T')[0];
            const endDate = now.toISOString().split('T')[0];

            for (let i = 0; i < connection.accounts.length; i++) {
                const account = connection.accounts[i];
                console.log(`${i + 1}. ${account.name}`);
                console.log(`   ID: ${account.id}`);
                console.log(`   Account ID: ${account.account_id}`);

                try {
                    // Try to fetch campaigns for this account
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

                        console.log(`   Campanhas: ${campaigns.length} registros`);
                        console.log(`   Investimento (Mês Atual): R$ ${total.spend.toFixed(2)}`);
                        console.log(`   Leads: ${total.leads}`);
                        console.log(`   CPL: R$ ${total.leads > 0 ? (total.spend / total.leads).toFixed(2) : '0.00'}`);

                        // Show first 3 campaign names
                        const uniqueNames = [...new Set(campaigns.map(c => c.campaign_name))];
                        console.log(`   Campanhas únicas: ${uniqueNames.length}`);
                        console.log('   Exemplos:');
                        uniqueNames.slice(0, 3).forEach(name => {
                            console.log(`     - ${name}`);
                        });

                        // Check if matches user's reported values
                        if (Math.abs(total.spend - 1900.85) < 100 && Math.abs(total.leads - 19) < 10) {
                            console.log('   ✅ POSSÍVEL MATCH! (próximo de R$ 1.900,85 / 19 leads)');
                        }
                    } else {
                        console.log('   Sem campanhas no período');
                    }
                } catch (error) {
                    console.log(`   ❌ Erro ao buscar campanhas: ${error.message}`);
                }

                console.log('');
            }

            console.log('\n=== QUAL CONTA USAR? ===');
            console.log('Procure pela conta que tem:');
            console.log('  - Investimento próximo de R$ 1.900,85');
            console.log('  - 19 leads');
            console.log('  - Campanhas da APOLAR (não ANDAR)');

        } else {
            console.log('Nenhuma conta de anúncios encontrada!');
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

listAllAdAccounts();
