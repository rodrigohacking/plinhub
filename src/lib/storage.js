import { supabase } from './supabase';
import { toast } from 'sonner';

export const STORAGE_KEY = 'plin_system_data_v4';
const COMPANIES_CONFIG_KEY = 'plin_companies_config';

export const INITIAL_DATA = {
    companies: [],
    sales: [],
    campaigns: [],
    goals: [],
    metrics: []
};

// Seed functionality removed - data sourced from Supabase

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

        const isStringId = typeof companyId === 'string' && companyConfig.id.length > 20;
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
                const errText = await companyResponse.text();
                if (companyResponse.status === 500 && errText.toLowerCase().includes('duplicate')) {
                    const allRes = await fetch('/api/companies');
                    if (allRes.ok) {
                        const all = await allRes.json();
                        const existing = all.find(c => c.name.toLowerCase().trim() === companyConfig.name.toLowerCase().trim());

                        if (existing) {
                            fetchMethod = 'PUT';
                            url = `/api/companies/${existing.id}`;
                            companyId = existing.id;

                            companyResponse = await fetch(url, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: companyConfig.name })
                            });
                        } else {
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

export async function getData(range = 'this-month') {
    let localData;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
        localData = { ...INITIAL_DATA };
    } else {
        try {
            const parsed = JSON.parse(existing);
            localData = {
                ...INITIAL_DATA,
                ...parsed
            };
        } catch (e) {
            console.error("Data corruption detected, resetting.", e);
            localData = { ...INITIAL_DATA };
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
                    // Fetch metrics history to support dashboard filters
                    const res = await fetch(`/api/metrics/${company.id}?range=${range}`);
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
                .in('company_id', companyIds);

            if (goalsError) {
                console.warn("[getData] Failed to fetch Goals:", goalsError);
            } else {
                const fetchedGoals = (goalsData || []).map(g => ({
                    companyId: g.company_id,
                    month: g.month,
                    year: g.year,
                    revenue: g.sales_goal || 0,
                    deals: g.sales_count_goal || 0,
                    leads: g.leads_goal || 0,
                    ticket: g.ticket_goal || 0,
                    investment: g.investment_goal || 0,
                    roi: g.roi_goal || 0,
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
    let dbSales = [];
    try {
        if (dbCompanies && dbCompanies.length > 0) {
            console.log("Fetching campaigns and sales via Backend API...");

            // Fetch campaigns AND sales for each company in parallel
            const promises = dbCompanies.map(async (company) => {
                const [campaignsRes, salesRes] = await Promise.all([
                    fetch(`/api/campaigns/${company.id}?range=${range}`).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`/api/sales/${company.id}?range=${range}`).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                return { campaigns: campaignsRes, sales: salesRes };
            });

            const results = await Promise.all(promises);
            dbCampaigns = results.flatMap(r => r.campaigns);
            dbSales = results.flatMap(r => r.sales);
            console.log(`[getData] Fetched ${dbCampaigns.length} campaigns, ${dbSales.length} sales from API.`);
        }
    } catch (e) {
        console.warn("[getData] Error fetching campaigns/sales:", e);
    }

    // 3. Select Companies
    const formattedCompanies = dbCompanies.map(c => {
        const flatCompany = {
            ...c,
            id: c.id,
            name: c.name
        };

        if (c.Integration && c.Integration.length > 0) {
            c.Integration.forEach(integration => {
                if (integration.type === 'pipefy') {
                    flatCompany.pipefyOrgId = integration.pipefyOrgId;
                    flatCompany.pipefyPipeId = integration.pipefyPipeId;
                    flatCompany.pipefyToken = integration.pipefyToken;
                    if (integration.settings) {
                        try {
                            const settings = typeof integration.settings === 'string'
                                ? JSON.parse(integration.settings)
                                : integration.settings;
                            Object.assign(flatCompany, settings);
                        } catch (e) { }
                    }
                }
                if (integration.type === 'meta_ads') {
                    flatCompany.metaAdAccountId = integration.metaAdAccountId;
                    flatCompany.metaToken = integration.metaAccessToken;
                }
            });
        }
        return flatCompany;
    });

    localData.companies = formattedCompanies;

    // 4. Fetch Details for each company
    const companyPromises = formattedCompanies.map(async (company) => {
        let apiSales = [];
        let apiCampaigns = [];

        // Sales
        if (dbSales.length > 0) {
            const relevantSales = dbSales.filter(s => String(s.company_id) === String(company.id));
            apiSales = relevantSales.map(s => {
                let labels = [];
                try {
                    labels = typeof s.labels === 'string' ? JSON.parse(s.labels) : (s.labels || []);
                } catch (e) { }

                return {
                    id: s.id,
                    companyId: s.company_id,
                    client: s.client,
                    status: s.status,
                    amount: Number(s.amount || 0),
                    date: s.date,
                    createdAt: s.created_at_pipefy || s.date,
                    wonDate: s.won_date,
                    product: s.product,
                    phaseName: s.phase_name,
                    phaseId: s.phase_id,
                    labels: labels,
                    channel: s.channel || 'Orgânico',
                    seller: s.seller,
                    lossReason: s.loss_reason,
                    daysToClose: s.days_to_close
                };
            });
        }

        // Campaigns
        if (dbCampaigns.length > 0) {
            const relevant = dbCampaigns.filter(c => String(c.company_id) === String(company.id));
            apiCampaigns = relevant.map(c => ({
                id: c.id,
                campaignId: c.campaignId || c.id,
                companyId: c.company_id,
                name: c.name,
                startDate: c.start_date,
                endDate: c.end_date,
                investment: Number(c.investment || 0),
                leads: Number(c.leads || 0),
                impressions: Number(c.impressions || 0),
                clicks: Number(c.clicks || 0),
                channel: c.channel || 'Meta Ads'
            }));
        }

        return {
            companyId: company.id,
            sales: apiSales,
            campaigns: apiCampaigns
        };
    });

    const results = await Promise.all(companyPromises);
    results.forEach(({ companyId, sales, campaigns }) => {
        localData.sales = (localData.sales || []).filter(s => String(s.companyId) !== String(companyId)).concat(sales);
        localData.campaigns = (localData.campaigns || []).filter(c => String(c.companyId) !== String(companyId)).concat(campaigns);
    });

    if (dbMetrics.length > 0) {
        const fetchedCompanyIds = new Set(dbMetrics.map(m => String(m.companyId)));
        localData.metrics = (localData.metrics || []).filter(m => !fetchedCompanyIds.has(String(m.companyId))).concat(dbMetrics);
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
