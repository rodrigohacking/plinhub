
import { fetchPipefyDeals } from '../services/pipefy';
import { fetchMetaCampaigns } from '../services/meta';
import { supabase } from './supabase';

export const STORAGE_KEY = 'plin_system_data_v4';
const COMPANIES_CONFIG_KEY = 'plin_companies_config'; // New: Array of company configs

export const INITIAL_DATA = {
    companies: [],
    sales: [],
    campaigns: [],
    goals: []
};

// Helper to generate random dates
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}



// Generate Seed Data
export function generateSeedData() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return JSON.parse(existing);

    const sales = [];
    const campaigns = [];
    const goals = [];
    const companies = INITIAL_DATA.companies;
    const channels = ['Online', 'Loja Física', 'Telefone', 'Marketplace', 'Facebook', 'Instagram'];
    const marketingChannels = ['Google Ads', 'Facebook', 'Instagram', 'Email', 'Linkedin'];
    const sellers = ['Ana', 'Carlos', 'Beatriz', 'João', 'Mariana'];

    const statuses = ['new', 'qualified', 'won', 'lost'];
    const lossReasons = ['Preço alto', 'Concorrente', 'Sem contato', 'Desistência', 'Produto indisponível'];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    companies.forEach(company => {
        // SALES
        for (let i = 0; i < 150; i++) {
            const date = randomDate(startDate, endDate);
            const daysToClose = Math.floor(Math.random() * 60) + 1;
            const createdAt = new Date(date);
            createdAt.setDate(createdAt.getDate() - daysToClose);

            const amount = Math.floor(Math.random() * 5000) + 100;

            let status = 'won';
            const r = Math.random();
            if (r < 0.2) status = 'new';
            else if (r < 0.5) status = 'qualified';
            else if (r < 0.8) status = 'won';
            else status = 'lost';

            // Force some Meta sales for demo
            const channel = (i % 3 === 0) ? (Math.random() > 0.5 ? 'Facebook' : 'Instagram') : channels[Math.floor(Math.random() * channels.length)];

            // Add fake UTMs for creative ranking
            let utm_content = null;
            if (['Facebook', 'Instagram'].includes(channel)) {
                utm_content = ['Vídeo Depoimento', 'Carrossel Oferta', 'Foto Lifestyle', 'Stories Quiz', 'Reels Viral'][Math.floor(Math.random() * 5)];
            }

            const deal = {
                id: `deal_${company.id}_${i}`,
                companyId: company.id,
                title: `Venda ${i}`,
                date: date.toISOString(), // Close Date
                createdAt: createdAt.toISOString(),
                daysToClose: daysToClose,
                amount: amount,
                items: Math.floor(Math.random() * 5) + 1,
                channel: channel,
                seller: sellers[Math.floor(Math.random() * sellers.length)],
                client: `Cliente ${i}`,
                status: status,
                lossReason: status === 'lost' ? lossReasons[Math.floor(Math.random() * lossReasons.length)] : null,
                utm_content: utm_content
            };
            sales.push(deal);
        }

        // CAMPAIGNS
        const campStartDate = new Date();
        campStartDate.setMonth(campStartDate.getMonth() - 3);

        // 1. Generate Historical Campaigns
        for (let i = 0; i < 10; i++) {
            const start = randomDate(campStartDate, endDate);
            const end = new Date(start);
            end.setDate(end.getDate() + 15);

            const investment = Math.floor(Math.random() * 2000) + 500;
            const impressions = Math.floor(investment * (Math.random() * 20 + 10));
            const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
            const leads = Math.floor(clicks * (Math.random() * 0.2 + 0.05));
            const conversions = Math.floor(leads * (Math.random() * 0.3 + 0.1));

            campaigns.push({
                id: `camp_${company.id}_${i}`,
                companyId: company.id,
                name: `Campanha ${marketingChannels[i % marketingChannels.length]} ${i + 1}`,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                investment,
                channel: marketingChannels[Math.floor(Math.random() * marketingChannels.length)],
                impressions,
                clicks,
                leads,
                conversions
            });
        }

        // 2. Force Active Campaigns (Current Month specific)
        const currentMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        for (let i = 0; i < 3; i++) {
            const start = randomDate(currentMonthStart, endDate);
            const end = new Date(start);
            end.setDate(end.getDate() + 30); // Goes into future

            const investment = Math.floor(Math.random() * 3000) + 1000;
            const impressions = Math.floor(investment * 15);
            const clicks = Math.floor(impressions * 0.03);
            const leads = Math.floor(clicks * 0.15);

            campaigns.push({
                id: `camp_active_${company.id}_${i}`,
                companyId: company.id,
                name: `[ACTIVE] Campanha Mensal ${i + 1}`,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                investment,
                channel: 'Instagram',
                impressions,
                clicks,
                leads,
                conversions: Math.floor(leads * 0.2)
            });
        }
    });

    const data = { companies, sales, campaigns, goals };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
}


// Get all company configurations
export function getCompaniesConfig() {
    const saved = localStorage.getItem(COMPANIES_CONFIG_KEY);
    return saved ? JSON.parse(saved) : [];
}

// Save company configurations
export function saveCompaniesConfig(configs) {
    localStorage.setItem(COMPANIES_CONFIG_KEY, JSON.stringify(configs));
}

// Add or update a company config (Sync to Supabase)
export async function saveCompanyConfig(companyConfig) {
    try {
        console.log("Saving Company to Supabase:", companyConfig);

        // 1. Upsert Company
        const { data: company, error: companyError } = await supabase
            .from('companies')  // Standardized to lowercase
            .upsert({
                id: companyConfig.id,
                name: companyConfig.name,
                cnpj: companyConfig.cnpj,
                logo: companyConfig.logo,
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (companyError) throw companyError;

        // 2. Upsert Integrations
        // Pipefy
        if (companyConfig.pipefyPipeId || companyConfig.pipefyToken) {
            const settings = JSON.stringify({
                wonPhase: companyConfig.wonPhase,
                wonPhaseId: companyConfig.wonPhaseId,
                lostPhase: companyConfig.lostPhase,
                lostPhaseId: companyConfig.lostPhaseId,
                qualifiedPhase: companyConfig.qualifiedPhase,
                qualifiedPhaseId: companyConfig.qualifiedPhaseId,
                valueField: companyConfig.valueField,
                lossReasonField: companyConfig.lossReasonField
            });

            const { error: pipefyError } = await supabase
                .from('integrations')
                .upsert({
                    // Composite Key mimic (companyId + type) needs unique constraint in DB
                    companyId: company.id,
                    type: 'pipefy',
                    pipefyOrgId: companyConfig.pipefyOrgId,
                    pipefyPipeId: companyConfig.pipefyPipeId,
                    pipefyToken: companyConfig.pipefyToken,
                    settings: settings,
                    isActive: true,
                    updatedAt: new Date().toISOString()
                }, { onConflict: 'companyId, type' }); // Requires unique index in DB

            if (pipefyError) console.error("Pipefy Sync Error:", pipefyError);
        }

        // Meta Ads
        if (companyConfig.metaAdAccountId || companyConfig.metaToken) {
            const { error: metaError } = await supabase
                .from('integrations')
                .upsert({
                    companyId: company.id,
                    type: 'meta_ads',
                    metaAdAccountId: companyConfig.metaAdAccountId,
                    metaAccessToken: companyConfig.metaToken,
                    isActive: true,
                    updatedAt: new Date().toISOString()
                }, { onConflict: 'companyId, type' });

            if (metaError) console.error("Meta Sync Error:", metaError);
        }

    } catch (e) {
        console.error("Error saving company config to Supabase:", e);
    }
}

// Delete a company config
export async function deleteCompanyConfig(companyId) {
    try {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', companyId);

        if (error) throw error;
    } catch (e) {
        console.error("Error deleting company from Supabase:", e);
    }
}

// Security: Admin PIN Management
const ADMIN_PIN_KEY = 'plin_admin_pin';

export function getAdminPin() {
    return localStorage.getItem(ADMIN_PIN_KEY);
}

export function setAdminPin(pin) {
    localStorage.setItem(ADMIN_PIN_KEY, pin);
}

export function checkAdminPin(inputPin) {
    const stored = getAdminPin();
    return stored === inputPin;
}


export async function getData() {
    // 1. Load base data structure (sales, campaigns, etc.) from local storage or seed
    // Ideally, these should also come from DB, but for now we only migrate 'companies' as requested.
    let localData;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
        localData = generateSeedData();
    } else {
        try {
            const parsed = JSON.parse(existing);
            // Deep Merge / Ensure Keys exist to prevent crashes
            localData = {
                ...INITIAL_DATA,
                ...parsed,
                companies: parsed.companies || [],
                sales: parsed.sales || [],
                campaigns: parsed.campaigns || [],
                goals: parsed.goals || []
            };
        } catch (e) {
            console.error("Data corruption detected, properly regenerating.", e);
            localData = generateSeedData();
        }
    }

    // 2. Fetch Companies from Supabase (Source of Truth)
    let dbCompanies = [];
    try {
        console.log("Fetching companies from Supabase table 'companies'...");
        // Check session debug
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Current Session User:", session?.user?.id || "NO SESSION");

        // Fetch Company AND its Integrations
        const { data: companies, error } = await supabase
            .from('companies')
            .select('*, integrations(*)');

        if (error) {
            console.error("Supabase API Error DETAILED:", JSON.stringify(error, null, 2));
            throw error;
        }

        console.log("Supabase Success! Rows fetched:", companies ? companies.length : 0);

        if (companies) {
            console.log("Companies fetched with integrations:", companies.length);
            // Transform Supabase structure to Frontend structure
            dbCompanies = companies.map(c => {
                const flatCompany = {
                    id: c.id,
                    name: c.name,
                    cnpj: c.cnpj,
                    logo: c.logo || null,
                    ...c // Preserve basic fields
                };

                // Flatten Integrations if any
                // Note: PostgREST returns relations as the table name, usually capitalized if the table is.
                if (c.integrations && c.integrations.length > 0) {
                    c.integrations.forEach(integration => {
                        if (integration.type === 'pipefy') {
                            flatCompany.pipefyOrgId = integration.pipefyOrgId;
                            flatCompany.pipefyPipeId = integration.pipefyPipeId;
                            flatCompany.pipefyToken = integration.pipefyToken;

                            if (!flatCompany.pipefyToken) {
                                console.warn(`[getData] Token MISSING for ${c.name} (Integration found but token empty)`);
                            }

                            // Parse settings
                            if (integration.settings) {
                                try {
                                    const settings = typeof integration.settings === 'string'
                                        ? JSON.parse(integration.settings)
                                        : integration.settings;

                                    Object.assign(flatCompany, settings);
                                } catch (e) {
                                    console.warn("Error parsing settings for company", c.id, e);
                                }
                            }
                        }
                        if (integration.type === 'meta_ads') {
                            flatCompany.metaAdAccountId = integration.metaAdAccountId;
                            flatCompany.metaToken = integration.metaAccessToken;
                        }
                    });
                } else {
                    console.warn(`[getData] No Integrations found for ${c.name} (Supabase array empty)`);
                }
                return flatCompany;
            });
        }
    } catch (err) {
        console.error("Supabase API Error:", err);
    }

    // 3. Format DB Companies for Frontend
    // Ensure IDs are consistent (DB sends strings/numbers, frontend needs to handle them)
    // PLUS: ONE-TIME DATA MIGRATION CHECK
    // If we have local configs but DB has empty configs (migration scenario), we push local to DB.

    const localConfigs = getCompaniesConfig();

    const formattedCompanies = await Promise.all(dbCompanies.map(async (c) => {
        const companyIdStr = c.id.toString();

        // Find matching local config
        const localMatch = localConfigs.find(lc => String(lc.id) === companyIdStr);

        let mergedCompany = {
            ...c,
            logo: c.logo || null,
            id: c.id
        };

        // Check if DB is missing tokens but local has them (Migration Logic)
        if (localMatch) {
            let needsSync = false;

            // Check Pipefy
            if (!c.pipefyToken && localMatch.pipefyToken) {
                mergedCompany.pipefyToken = localMatch.pipefyToken;
                mergedCompany.pipefyOrgId = localMatch.pipefyOrgId || c.pipefyOrgId;
                mergedCompany.pipefyPipeId = localMatch.pipefyPipeId || c.pipefyPipeId;
                // Sync legacy manual field mapping too? 
                // schema doesn't have individual phase ID fields in Company/Integration yet?
                // Wait, integration table has basic fields.
                // AdminSettings uses the fields returned by API.
                needsSync = true;
            }

            // Check Meta
            if (!c.metaToken && localMatch.metaToken) {
                mergedCompany.metaToken = localMatch.metaToken;
                mergedCompany.metaAdAccountId = localMatch.metaAdAccountId || c.metaAdAccountId;
                needsSync = true;
            }

            if (needsSync) {
                // Background Sync to DB to fix it for everyone
                console.log(`Migrating config for company ${c.name} to DB...`);
                try {
                    await fetch('/api/companies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(mergedCompany)
                    });
                } catch (e) {
                    console.error("Migration failed", e);
                }
            }
        }

        return mergedCompany;
    }));

    // CRITICAL FIX: Merge Local-Only Companies (Fallback)
    // If a company exists in LocalStorage but not in DB (e.g. offline creation or sync error),
    // we must include it. We also deduplicate by NAME to avoid "Andar Seguros" appearing twice with different IDs.
    const dbIds = new Set(formattedCompanies.map(c => String(c.id)));
    const dbNames = new Set(formattedCompanies.map(c => c.name.toLowerCase().trim()));

    localConfigs.forEach(localC => {
        const localId = String(localC.id);
        const localName = localC.name.toLowerCase().trim();

        // Skip if ID exists in DB
        if (dbIds.has(localId)) return;

        // Skip if Name exists in DB (Avoid Visual Duplicates)
        if (dbNames.has(localName)) {
            console.log(`[getData] Skipping local company "${localC.name}" - Name match found in DB.`);
            return;
        }

        if (localC.id !== 1 && localC.id !== 2) {
            console.log(`[getData] Found local-only company: ${localC.name} (${localC.id}). Adding to list AND syncing to DB.`);
            formattedCompanies.push(localC);

            // AUTO-SYNC: Persist this local-only company to the backend so it becomes global
            saveCompanyConfig(localC).then(() => {
                console.log(`[getData] Auto-synced company ${localC.name} to DB.`);
            }).catch(err => console.error("Auto-sync failed", err));
        }
    });

    // Override local companies with DB companies
    localData.companies = formattedCompanies;

    // 4. Fetch API data for each company (Pipefy/Meta)
    // We iterate over the *fetched* companies now.
    // No more merging with getCompaniesConfig()!
    const companyPromises = formattedCompanies.map(async (company) => {
        // ... (Logic for fetching deals/ads remains similar, but using 'company' from DB)

        let apiSales = [];
        let apiCampaigns = [];

        // Use company directly as it now has the config
        const effectiveCompany = company;

        // Try Pipefy
        if (effectiveCompany.pipefyToken && effectiveCompany.pipefyPipeId) {
            try {
                const isApolar = effectiveCompany.name?.toUpperCase().includes('APOLAR') || effectiveCompany.pipefyPipeId === '305634232';
                const isAndar = effectiveCompany.name?.toUpperCase().includes('ANDAR');

                const apolarConfig = isApolar ? {
                    wonPhase: 'Contrato Assinado (Ganho)',
                    lostPhase: 'Perdido',
                    qualifiedPhase: 'Em Contato',
                    valueField: 'Valor mensal dos honorários administrativos',
                    lossReasonField: 'Proposta Enviada'
                } : {};

                const andarConfig = isAndar ? {
                    wonPhase: 'Apólice Emitida',
                    lostPhase: 'Perdido',
                    qualifiedPhase: 'Cotação',
                    valueField: 'Prêmio Líquido', // Common in insurance
                    lossReasonField: 'Motivo Recusa'
                } : {};

                const pipefyResult = await fetchPipefyDeals(
                    effectiveCompany.pipefyOrgId,
                    effectiveCompany.pipefyPipeId,
                    effectiveCompany.pipefyToken,
                    {
                        wonPhase: effectiveCompany.wonPhase || apolarConfig.wonPhase || andarConfig.wonPhase,
                        wonPhaseId: effectiveCompany.wonPhaseId,
                        lostPhase: effectiveCompany.lostPhase || apolarConfig.lostPhase || andarConfig.lostPhase,
                        lostPhaseId: effectiveCompany.lostPhaseId,
                        qualifiedPhase: apolarConfig.qualifiedPhase || andarConfig.qualifiedPhase,
                        qualifiedPhaseId: effectiveCompany.qualifiedPhaseId,
                        valueField: effectiveCompany.valueField || apolarConfig.valueField || andarConfig.valueField,
                        lossReasonField: effectiveCompany.lossReasonField || andarConfig.lossReasonField || apolarConfig.lossReasonField
                    }
                );

                const pipefySales = Array.isArray(pipefyResult) ? pipefyResult : pipefyResult.deals;
                if (!Array.isArray(pipefyResult) && pipefyResult.debug) {
                    console.log(`[Storage] Pipefy Debug for ${effectiveCompany.name}:`, pipefyResult.debug);
                }

                if (isApolar) {
                    console.log("DEBUG APOLAR - Config:", apolarConfig);
                    console.log("DEBUG APOLAR - Token:", effectiveCompany.pipefyToken ? "Exists" : "Missing");
                    console.log("DEBUG APOLAR - Raw Sales Count:", pipefySales.length);
                    console.log("DEBUG APOLAR - First Sale Sample:", pipefySales[0]);
                }

                apiSales = pipefySales.map(s => ({ ...s, companyId: company.id }));
            } catch (e) {
                console.warn(`Failed to load Pipefy data for company ${company.id}`, e);
            }
        }

        // Try Meta Ads
        if (effectiveCompany.metaToken && effectiveCompany.metaAdAccountId) {
            try {
                const metaCampaigns = await fetchMetaCampaigns(effectiveCompany.metaAdAccountId, effectiveCompany.metaToken);
                apiCampaigns = metaCampaigns.map(c => ({ ...c, companyId: company.id }));
            } catch (e) {
                console.warn(`Failed to load Meta data for company ${company.id}`, e);
            }
        }

        return {
            companyId: company.id,
            sales: apiSales,
            campaigns: apiCampaigns
        };
    });

    const results = await Promise.all(companyPromises);

    // Merge results into localData
    results.forEach(({ companyId, sales, campaigns }) => {
        // ALWAYS remove existing (seed/stale) data for this company
        // This ensures that if Pipefy returns 0 deals, we show 0, not fake data.
        localData.sales = localData.sales.filter(s => String(s.companyId) !== String(companyId)).concat(sales);
        localData.campaigns = localData.campaigns.filter(c => String(c.companyId) !== String(companyId)).concat(campaigns);
    });

    return localData;
}

export function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
