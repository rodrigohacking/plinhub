const { decrypt } = require('./backend/src/utils/encryption');
const supabase = require('./backend/src/utils/supabase');
const metaAdsService = require('./backend/src/services/metaAds.service');

async function debug() {
    console.log("--- DEBUG: Meta Ads Leads ---");
    
    // 1. Pegar integração da Andar Seguros (ou a empresa ativa)
    const { data: integrations, error } = await supabase
        .from('Integration')
        .select('companyId, metaAccessToken, metaAdAccountId, Company(name)')
        .eq('type', 'meta_ads')
        .eq('isActive', true);

    if (error || !integrations) {
        console.error("Erro ao buscar integrações:", error);
        return;
    }

    for (const integration of integrations) {
        console.log(`\nEmpresa: ${integration.Company?.name} (${integration.companyId})`);
        console.log(`Ad Account: ${integration.metaAdAccountId}`);

        const token = decrypt(integration.metaAccessToken);
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const startStr = startDate.toISOString().split('T')[0];

        console.log(`Buscando insights de ${startStr} até ${endDate}...`);

        try {
            // Testar a extração bruta de ações
            const actId = integration.metaAdAccountId.startsWith('act_') ? integration.metaAdAccountId : `act_${integration.metaAdAccountId}`;
            const response = await require('axios').get(`https://graph.facebook.com/v20.0/${actId}/insights`, {
                params: {
                    access_token: token,
                    time_range: JSON.stringify({ since: startStr, until: endDate }),
                    fields: 'campaign_name,actions,spend',
                    level: 'campaign',
                    limit: 10
                }
            });

            const campaigns = response.data?.data || [];
            console.log(`Campanhas encontradas: ${campaigns.length}`);

            campaigns.forEach(c => {
                console.log(`- ${c.campaign_name}: `);
                if (c.actions) {
                    const leadActions = c.actions.filter(a => a.action_type.toLowerCase().includes('lead'));
                    if (leadActions.length > 0) {
                        leadActions.forEach(a => console.log(`  - ${a.action_type}: ${a.value}`));
                    } else {
                        console.log("  - Nenhuma ação de lead encontrada.");
                        // Mostrar todas as ações para debug
                        console.log("  - Todas as ações:", c.actions.map(a => a.action_type).join(', '));
                    }
                } else {
                    console.log("  - Sem ações registradas.");
                }
            });

        } catch (e) {
            console.error(`Erro ao buscar dados para ${integration.companyId}:`, e.message);
            if (e.response) console.error(e.response.data);
        }
    }
}

debug();
