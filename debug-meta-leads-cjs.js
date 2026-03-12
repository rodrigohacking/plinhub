const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

function decrypt(text) {
    if (!text || !text.includes(':')) return text;
    try {
        const [ivHex, encryptedHex] = text.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-secret-1234567890123456', 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return text;
    }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log("--- DEBUG: Meta Ads Leads (CJS) ---");
    
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
        const token = decrypt(integration.metaAccessToken);
        const actId = integration.metaAdAccountId.startsWith('act_') ? integration.metaAdAccountId : `act_${integration.metaAdAccountId}`;
        
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const startStr = startDate.toISOString().split('T')[0];

        try {
            const response = await axios.get(`https://graph.facebook.com/v20.0/${actId}/insights`, {
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
                    }
                } else {
                    console.log("  - Sem ações registradas.");
                }
            });

        } catch (e) {
            console.error(`Erro para ${integration.companyId}:`, e.message);
        }
    }
}

debug();
