const cron = require('node-cron');
const supabase = require('../utils/supabase');
const syncService = require('../services/sync.service');
const { runCronSync } = require('../controllers/metaAdsSync.controller');
const { syncPipefyDeals } = require('../controllers/pipefySync.controller');
const { decrypt } = require('../utils/encryption');

/**
 * Busca todas as integrações Meta Ads ativas e executa o sync para cada empresa.
 * @param {number} daysToSync - Quantos dias para trás sincronizar (1 = somente hoje)
 */
async function syncAllCompanies(daysToSync = 7) {
    // Step 1: Find active integrations to get company IDs
    const { data: activeIntegrations, error: intError } = await supabase
        .from('Integration')
        .select('companyId')
        .eq('isActive', true);

    if (intError) throw new Error(intError.message);

    const companyIds = [...new Set(activeIntegrations.map(i => i.companyId))];

    if (companyIds.length === 0) {
        console.log('No companies with active integrations found.');
        return;
    }

    // Step 2: Fetch companies
    const { data: companies, error: compError } = await supabase
        .from('Company')
        .select('id, name')
        .in('id', companyIds);

    if (compError) throw new Error(compError.message);

    console.log(`Found ${companies.length} companies to sync (daysToSync=${daysToSync})`);

    for (const company of companies) {
        try {
            console.log(`Syncing company: ${company.name} (ID: ${company.id})`);

            const { data: metaInt } = await supabase
                .from('Integration')
                .select('id, metaAdAccountId, metaAccessToken, metaStatus, metaTokenExpiry')
                .eq('companyId', company.id)
                .eq('type', 'meta_ads')
                .eq('isActive', true)
                .single();

            if (metaInt && metaInt.metaAccessToken && metaInt.metaStatus !== 'disabled') {
                await runCronSync(company.id, metaInt, daysToSync);
            } else {
                console.log(`  ↳ No active Meta Ads integration for ${company.name}, skipping.`);
            }

            if (daysToSync > 1) {
                // Pipefy sync only no cron diário completo (não no horário)
                const { data: pipefyInt } = await supabase
                    .from('Integration')
                    .select('*')
                    .eq('companyId', company.id)
                    .eq('type', 'pipefy')
                    .eq('isActive', true)
                    .single();

                if (pipefyInt && pipefyInt.pipefyToken) {
                    await syncService.syncPipefy(company.id, pipefyInt).catch(e => {
                        console.error(`Pipefy metrics sync failed for ${company.id}:`, e.message);
                    });

                    try {
                        let token;
                        try { token = decrypt(pipefyInt.pipefyToken); } catch (e) { token = pipefyInt.pipefyToken; }
                        let settings = {};
                        if (pipefyInt.settings) {
                            try { settings = typeof pipefyInt.settings === 'string' ? JSON.parse(pipefyInt.settings) : pipefyInt.settings; } catch (e) {}
                        }
                        const { syncPipefyDeals } = require('../controllers/pipefySync.controller');
                        const result = await syncPipefyDeals(company.id, pipefyInt.pipefyPipeId, token, settings);
                        console.log(`  ↳ Pipefy cards synced: ${result.rowsUpserted} rows for ${company.name}`);
                        await supabase.from('Integration')
                            .update({ lastSync: new Date().toISOString() })
                            .eq('companyId', company.id)
                            .eq('type', 'pipefy');
                    } catch (e) {
                        console.error(`  ↳ Pipefy cards sync failed for ${company.name}:`, e.message);
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to sync company ${company.id}:`, error);
        }
    }
}

/**
 * Sincroniza Pipefy para todas as empresas com integração ativa.
 * Usa o token do banco de dados; se ausente, cai para PIPEFY_TOKEN do .env.
 */
async function syncPipefy() {
    const { data: activeIntegrations, error } = await supabase
        .from('Integration')
        .select('companyId')
        .eq('type', 'pipefy')
        .eq('isActive', true);

    if (error) throw new Error(error.message);

    const companyIds = [...new Set((activeIntegrations || []).map(i => i.companyId))];

    if (companyIds.length === 0) {
        // Nenhuma integração no banco — tenta fallback de env se houver
        if (process.env.PIPEFY_TOKEN) {
            console.log('  ↳ Nenhuma integração Pipefy no banco. Nada a sincronizar (PIPEFY_TOKEN de env não tem companyId associado).');
        }
        return;
    }

    for (const companyId of companyIds) {
        try {
            const { data: pipefyInt } = await supabase
                .from('Integration')
                .select('*')
                .eq('companyId', companyId)
                .eq('type', 'pipefy')
                .eq('isActive', true)
                .single();

            if (!pipefyInt) continue;

            // Resolve token: banco → fallback env
            let token;
            try {
                token = pipefyInt.pipefyToken ? decrypt(pipefyInt.pipefyToken) : null;
            } catch (e) {
                token = pipefyInt.pipefyToken;
            }
            if (!token) token = process.env.PIPEFY_TOKEN;

            if (!token) {
                console.warn(`  ↳ Sem token Pipefy para company ${companyId}, pulando.`);
                continue;
            }

            // Usa integração com token resolvido
            const intWithToken = { ...pipefyInt, pipefyToken: token };

            await syncService.syncPipefy(companyId, intWithToken, 7).catch(e => {
                console.error(`  ↳ Pipefy metrics sync falhou para ${companyId}:`, e.message);
            });

            try {
                let settings = {};
                if (pipefyInt.settings) {
                    try { settings = typeof pipefyInt.settings === 'string' ? JSON.parse(pipefyInt.settings) : pipefyInt.settings; } catch (e) {}
                }
                const { syncPipefyDeals } = require('../controllers/pipefySync.controller');
                const result = await syncPipefyDeals(companyId, pipefyInt.pipefyPipeId, token, settings);
                console.log(`  ↳ Pipefy cards synced: ${result.rowsUpserted} rows para company ${companyId}`);
                await supabase.from('Integration')
                    .update({ lastSync: new Date().toISOString() })
                    .eq('companyId', companyId)
                    .eq('type', 'pipefy');
            } catch (e) {
                console.error(`  ↳ Pipefy cards sync falhou para company ${companyId}:`, e.message);
            }
        } catch (e) {
            console.error(`  ↳ Erro ao sincronizar Pipefy para company ${companyId}:`, e.message);
        }
    }
}

/**
 * Daily sync cron job
 * Runs every day at 6 AM
 */
function startCronJobs() {
    const schedule = process.env.SYNC_SCHEDULE || '0 6 * * *';

    // ─── Cron Diário (6h) — sincroniza 7 dias + Pipefy ─────────────────────────
    cron.schedule(schedule, async () => {
        console.log('🔄 Starting daily sync job...');
        const startTime = Date.now();

        try {
            await syncAllCompanies(7);

            const duration = Date.now() - startTime;
            console.log(`✅ Daily sync completed in ${duration}ms`);
        } catch (error) {
            console.error('❌ Daily sync failed:', error);
        }
    });

    // ─── Cron Horário — sincroniza SOMENTE hoje (Meta Ads em tempo quase-real) ──
    // Executa a cada hora cheia (ex: 09:00, 10:00, 11:00...)
    // daysToSync=1 → busca apenas o dia atual no Meta Ads API
    const hourlySchedule = process.env.SYNC_HOURLY_SCHEDULE || '0 * * * *';
    cron.schedule(hourlySchedule, async () => {
        console.log('⚡ [Hourly] Syncing today\'s Meta Ads data...');
        const startTime = Date.now();
        try {
            await syncAllCompanies(1); // apenas o dia de hoje
            const duration = Date.now() - startTime;
            console.log(`✅ [Hourly] Done in ${duration}ms`);
        } catch (error) {
            console.error('❌ [Hourly] Meta Ads sync failed:', error);
        }
    });

    // ─── Cron Pipefy — sincroniza a cada 2 horas (dados do dia atual) ──────────
    // Mantém o dashboard atualizado enquanto webhooks não estão disponíveis.
    // Quando os webhooks do Pipefy forem liberados, este cron pode ser desativado
    // setando SYNC_PIPEFY_SCHEDULE=disabled no .env
    const pipefySchedule = process.env.SYNC_PIPEFY_SCHEDULE || '0 */2 * * *';
    if (pipefySchedule !== 'disabled') {
        cron.schedule(pipefySchedule, async () => {
            console.log('🔁 [Pipefy] Syncing Pipefy data...');
            const startTime = Date.now();
            try {
                await syncPipefy();
                const duration = Date.now() - startTime;
                console.log(`✅ [Pipefy] Done in ${duration}ms`);
            } catch (error) {
                console.error('❌ [Pipefy] Sync failed:', error);
            }
        });
    }

    console.log(`📅 Cron job scheduled: ${schedule} (diário) | ${hourlySchedule} (Meta horário) | ${pipefySchedule} (Pipefy 2h)`);

}

module.exports = { startCronJobs };
