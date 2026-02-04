
import { fetchPipefyDeals } from '../services/pipefy';
import { fetchMetaCampaigns } from '../services/meta';
import { supabase } from './supabase';
import { toast } from 'sonner';

export const STORAGE_KEY = 'plin_system_data_v4';
const COMPANIES_CONFIG_KEY = 'plin_companies_config'; // New: Array of company configs

export const INITIAL_DATA = {
    companies: [],
    sales: [],
    campaigns: [],
    goals: [],
    metrics: []
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

// Add or update a company config (Sync to Supabase via Backend API)
export async function saveCompanyConfig(companyConfig) {
    try {
        console.log("Saving Company via API:", companyConfig);

        let url = '/api/companies';
        let fetchMethod = 'POST';
        let companyId = companyConfig.id;

        // Heuristic: 
        // 1. If ID is a Number (1, 2, or Timestamp) -> It is LOCAL (Seed or Temp). We must POST (Create).
        // 2. If ID is a String (UUID) -> It is from DB. We must PUT (Update).

        const isStringId = typeof companyId === 'string' && companyConfig.id.length > 20; // UUID is 36 chars
        const isDbId = isStringId;

        if (isDbId) {
            fetchMethod = 'PUT';
            url = `/api/companies/${companyId}`;
        }

        let companyResponse;

        try {
            companyResponse = await fetch(url, {
                method: fetchMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: companyConfig.name })
            });

            if (!companyResponse.ok) {
                const errText = await companyResponse.text(); // Get server error

                // ROBUSTNESS: If Duplicate Key Error (Unique Constraint on Name),
                // it means the company EXISTS but we tried to POST (or PUT to wrong ID).
                // We should FIND the ID by Name and retry as PUT.
                if (companyResponse.status === 500 && errText.toLowerCase().includes('duplicate')) {
                    console.warn("Duplicate Name detected (500). Retrying as UPDATE (Upsert logic)... Error:", errText);

                    // 1. Fetch all companies to find the ID
                    const allRes = await fetch('/api/companies');
                    if (allRes.ok) {
                        const all = await allRes.json();
                        const existing = all.find(c => c.name.toLowerCase().trim() === companyConfig.name.toLowerCase().trim());

                        if (existing) {
                            console.log(`Found existing company "${existing.name}" with ID ${existing.id}. Switching to PUT.`);
                            fetchMethod = 'PUT';
                            url = `/api/companies/${existing.id}`;
                            companyId = existing.id; // Update local var for integrations

                            companyResponse = await fetch(url, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: companyConfig.name })
                            });
                        } else {
                            // Name matches nothing? Then why duplicate? Race condition or soft-deleted?
                            // Throw original error.
                            throw new Error(`Failed to save company (Duplicate): ${errText}`);
                        }
                    }
                } else {
                    throw new Error(`Failed to save company: ${companyResponse.status} ${errText}`);
                }
            }
        } catch (innerErr) {
            throw innerErr;
        }

        if (!companyResponse.ok) {
            const errText = await companyResponse.text().catch(() => '');
            throw new Error(`Failed to save company: ${companyResponse.status} ${errText}`);
        }

        const company = await companyResponse.json();
        const realId = company.id;

        // Now Save Integrations
        // Pipefy
        if (companyConfig.pipefyPipeId || companyConfig.pipefyToken) {
            const pipeRes = await fetch(`/api/integrations/${realId}/pipefy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pipefyOrgId: companyConfig.pipefyOrgId,
                    pipefyPipeId: companyConfig.pipefyPipeId,
                    pipefyToken: companyConfig.pipefyToken,
                    settings: {
                        wonPhase: companyConfig.wonPhase,
                        wonPhaseId: companyConfig.wonPhaseId,
                        lostPhase: companyConfig.lostPhase,
                        lostPhaseId: companyConfig.lostPhaseId,
                        qualifiedPhase: companyConfig.qualifiedPhase,
                        qualifiedPhaseId: companyConfig.qualifiedPhaseId,
                        valueField: companyConfig.valueField,
                        lossReasonField: companyConfig.lossReasonField
                    }
                })
            });
            if (!pipeRes.ok) console.warn("Pipefy Integration Save Warning:", await pipeRes.text());
        }

        // Meta Ads (Manual Token)
        if (companyConfig.metaAdAccountId || companyConfig.metaToken) {
            const metaRes = await fetch(`/api/integrations/${realId}/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metaAdAccountId: companyConfig.metaAdAccountId,
                    metaToken: companyConfig.metaToken
                })
            });
            if (!metaRes.ok) console.warn("Meta Integration Save Warning:", await metaRes.text());
        }

        // Return the REAL company ID and data so the UI can update
        return { ...companyConfig, id: realId };

    } catch (e) {
        console.error("Error saving company config via API:", e);
        throw e;
    }
}

// Delete a company config
export async function deleteCompanyConfig(companyId) {
    try {
        const { error } = await supabase
            .from('Company')
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

        // STRATEGY CHANGE: Use Backend API to bypass RLS
        // The backend uses Prisma (Server Role) so it can see everything.
        let companies = [];
        let apiError = null;

        try {
            const response = await fetch('/api/companies');
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();

            if (Array.isArray(data)) {
                companies = data;
                console.log("[getData] Fetched via API (Success):", companies.length);
            } else {
                throw new Error("API returned invalid format (not array)");
            }
        } catch (err) {
            console.warn("[getData] API Fetch failed. Falling back to Supabase Direct.", err);
            apiError = err;

            // Fallback: Supabase Direct (Subject to RLS)
            const { data: fallbackData, error: fallbackSupabaseError } = await supabase
                .from('Company')
                .select('*, Integration(*)');

            if (fallbackSupabaseError) {
                console.error("Critical: Both API and Supabase Direct failed.", fallbackSupabaseError);
                toast.error(`Erro crítico de conexão: ${fallbackSupabaseError.message}`);
                // return { companies: [] }; // Don't return empty yet, merge local
            } else {
                companies = fallbackData || [];
                // Manual Flattening for Supabase Direct result (API does it automatically)
                companies = companies.map(c => {
                    const flat = { ...c };
                    if (c.Integration && c.Integration.length > 0) {
                        c.Integration.forEach(integration => {
                            if (integration.type === 'pipefy') {
                                flat.pipefyOrgId = integration.pipefyOrgId;
                                flat.pipefyPipeId = integration.pipefyPipeId;
                                flat.pipefyToken = integration.pipefyToken;
                            }
                            if (integration.type === 'meta_ads') {
                                flat.metaAdAccountId = integration.metaAdAccountId;
                                flat.metaToken = integration.metaAccessToken;
                            }
                        });
                    }
                    return flat;
                });
            }
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
                if (c.Integration && c.Integration.length > 0) {
                    c.Integration.forEach(integration => {
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

    // 2.5 Fetch Metrics (Targets/Goals) from Supabase 'Metric' table
    // REFACTORED: Use Backend API to bypass RLS (Production Fix)
    let dbMetrics = [];
    try {
        if (dbCompanies && dbCompanies.length > 0) {
            console.log("Fetching metrics via Backend API...");

            const promises = dbCompanies.map(async (company) => {
                try {
                    // Fetch 365 days of history to support dashboard filters
                    const res = await fetch(`/api/metrics/${company.id}?range=365d`);
                    if (res.ok) {
                        return await res.json();
                    }
                    console.warn(`Failed to fetch metrics for ${company.name}: ${res.status}`);
                    return [];
                } catch (err) {
                    console.warn(`Error fetching metrics for ${company.name}`, err);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            dbMetrics = results.flat();
            console.log(`[getData] Fetched ${dbMetrics.length} metrics/targets from API.`);
        }
    } catch (e) {
        console.warn("[getData] Error fetching metrics:", e);
    }

    // 2.5.1 Fetch Goals (Source: 'goals' table)
    try {
        if (dbCompanies && dbCompanies.length > 0) {
            const companyIds = dbCompanies.map(c => c.id);
            const { data: goalsData, error: goalsError } = await supabase
                .from('goals')
                .select('*')
                .in('companyId', companyIds);

            if (goalsError) {
                console.warn("[getData] Failed to fetch Goals:", goalsError);
            } else {
                const fetchedGoals = (goalsData || []).map(g => ({
                    companyId: g.companyId,
                    month: g.month,
                    revenue: g.revenue || 0,
                    deals: g.deals || 0,
                    leads: g.leads || 0,
                    created_at: g.created_at
                }));

                // Merge into localData.goals
                // Overwrite local goals with DB goals if they exist for same month/company
                const dbGoalKeys = new Set(fetchedGoals.map(g => `${g.companyId}-${g.month}`));

                // Keep local goals that are NOT in DB (yet), add DB goals
                localData.goals = localData.goals.filter(g => !dbGoalKeys.has(`${g.companyId}-${g.month}`));
                localData.goals = localData.goals.concat(fetchedGoals);

                console.log(`[getData] Fetched ${fetchedGoals.length} goals from DB.`);
            }
        }
    } catch (e) {
        console.warn("[getData] Error fetching goals:", e);
    }

    // 2.6 Fetch Campaigns from Supabase (Source of Truth for Meta Ads)
    // Replaces direct frontend API calls
    let dbCampaigns = [];
    try {
        if (dbCompanies && dbCompanies.length > 0) {
            console.log("Fetching campaigns via Backend API (Bypassing RLS)...");

            // Fetch for each company (Limit 90 days by default)
            const promises = dbCompanies.map(async (company) => {
                try {
                    const res = await fetch(`/api/campaigns/${company.id}?range=90d`);
                    if (res.ok) {
                        return await res.json();
                    }
                    console.warn(`Failed to fetch campaigns for ${company.name}: ${res.status}`);
                    return [];
                } catch (err) {
                    console.warn(`Error fetching campaigns for ${company.name}`, err);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            dbCampaigns = results.flat();
            console.log(`[getData] Fetched ${dbCampaigns.length} campaign records from API.`);
        }
    } catch (e) {
        console.warn("[getData] Error fetching campaigns:", e);
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
                toast.error(`Erro ao carregar Pipefy (${company.name}): ${e.message}`);
            }
        }

        // Try Meta Ads (From DB now)
        // We filter the pre-fetched dbCampaigns
        if (dbCampaigns.length > 0) {
            const relevant = dbCampaigns.filter(c => String(c.company_id) === String(company.id));
            if (relevant.length > 0) {
                apiCampaigns = relevant.map(c => ({
                    id: c.id,
                    companyId: c.company_id,
                    name: c.name,
                    startDate: c.start_date, // Map snake_case to camelCase
                    endDate: c.end_date,
                    investment: Number(c.investment || 0),
                    leads: Number(c.leads || 0),
                    impressions: Number(c.impressions || 0),
                    clicks: Number(c.clicks || 0),
                    channel: c.channel || 'Meta Ads'
                }));
            }
        } else if (effectiveCompany.metaToken && effectiveCompany.metaAdAccountId) {
            // Fallback: If DB is empty but we have tokens, maybe Sync hasn't run? 
            // We could try direct fetch, but let's stick to DB to enforce new architecture.
            console.log(`[getData] No DB campaigns for ${company.name}, waiting for backend sync.`);
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

    // Merge Metrics (Replace existing for these companies)
    if (dbMetrics.length > 0) {
        const fetchedCompanyIds = new Set(dbMetrics.map(m => String(m.companyId)));
        localData.metrics = localData.metrics.filter(m => !fetchedCompanyIds.has(String(m.companyId))).concat(dbMetrics);
    }

    return localData;
}

// Save Metric (Marketing Goals) to Supabase - via Backend API
export async function saveMetric(metric) {
    try {
        const response = await fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        return true;
    } catch (e) {
        console.error("Error saving metric:", e);
        throw e;
    }
}

// Save Sales Goal to Supabase (using Backend API to bypass RLS)
export async function saveSalesGoal(goal) {
    try {
        // Map Goal Schema to Metric Schema
        const metric = {
            companyId: goal.companyId,
            source: 'sales_goal', // Distinct source
            date: `${goal.month}-01`, // YYYY-MM-01
            label: 'monthly',
            revenue: goal.revenue,              // Faturamento
            cardsConverted: goal.deals,         // Volume
            cardsCreated: goal.leads,           // Leads
            cardsByPhase: JSON.stringify(goal.sdrGoals || {}) // SDR Goals stored as JSON string
        };

        // Use Proxy to Backend (which has Service Role)
        const response = await fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[saveSalesGoal] API Error: ${response.status} - ${errText}`);
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        return true;
    } catch (e) {
        console.error("Error saving sales goal:", e);
        // Re-throw with more detail if possible
        throw e;
    }
}

export function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
