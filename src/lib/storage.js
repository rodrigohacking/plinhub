
import { fetchPipefyDeals } from '../services/pipefy';
import { fetchMetaCampaigns } from '../services/meta';

export const STORAGE_KEY = 'plin_system_data_v2';
const COMPANIES_CONFIG_KEY = 'plin_companies_config'; // New: Array of company configs

export const INITIAL_DATA = {
    companies: [
        {
            id: 1,
            name: 'TechCorp',
            cnpj: '12.345.678/0001-90',
            logo: null
        },
        {
            id: 2,
            name: 'MarketPro',
            cnpj: '98.765.432/0001-10',
            logo: null
        }
    ],
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
    const channels = ['Online', 'Loja Física', 'Telefone', 'Marketplace'];
    const marketingChannels = ['Google Ads', 'Facebook', 'Instagram', 'Email', 'Linkedin'];
    const sellers = ['Ana', 'Carlos', 'Beatriz', 'João', 'Mariana'];

    const statuses = ['new', 'qualified', 'won', 'lost'];
    const lossReasons = ['Preço alto', 'Concorrente', 'Sem contato', 'Desistência', 'Produto indisponível'];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    companies.forEach(company => {
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

            const deal = {
                id: `deal_${company.id}_${i}`,
                companyId: company.id,
                title: `Venda ${i}`,
                date: date.toISOString(),
                createdAt: createdAt.toISOString(),
                daysToClose: daysToClose,
                amount: amount,
                items: Math.floor(Math.random() * 5) + 1,
                channel: channels[Math.floor(Math.random() * channels.length)],
                seller: sellers[Math.floor(Math.random() * sellers.length)],
                client: `Cliente ${i}`,
                status: status,
                lossReason: status === 'lost' ? lossReasons[Math.floor(Math.random() * lossReasons.length)] : null
            };
            sales.push(deal);
        }

        const campStartDate = new Date();
        campStartDate.setMonth(campStartDate.getMonth() - 3);
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

// Add or update a company config
export function saveCompanyConfig(companyConfig) {
    const configs = getCompaniesConfig();
    const existingIndex = configs.findIndex(c => c.id === companyConfig.id);

    if (existingIndex >= 0) {
        configs[existingIndex] = companyConfig;
    } else {
        configs.push(companyConfig);
    }

    saveCompaniesConfig(configs);
}

// Delete a company config
export function deleteCompanyConfig(companyId) {
    const configs = getCompaniesConfig();
    const filtered = configs.filter(c => c.id !== companyId);
    saveCompaniesConfig(filtered);
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
    // 1. Load base data (seed or cached)
    let localData;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
        localData = generateSeedData();
    } else {
        try {
            localData = JSON.parse(existing);
        } catch (e) {
            console.error("Data corruption detected, properly regenerating.", e);
            localData = generateSeedData();
        }
    }

    // 2. Get custom company configurations
    const customCompanies = getCompaniesConfig();

    // 3. Merge custom companies with base companies
    // Strategy: Custom companies get added to the list, base companies remain
    const allCompanies = [...localData.companies];

    customCompanies.forEach(customCo => {
        // Check if this company already exists in the list
        const existingIndex = allCompanies.findIndex(c => c.id === customCo.id);

        const companyData = {
            id: customCo.id,
            name: customCo.name,
            cnpj: customCo.cnpj || '00.000.000/0001-00',
            logo: customCo.logo || null,
            lastUpdate: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            allCompanies[existingIndex] = companyData;
        } else {
            allCompanies.push(companyData);
        }
    });

    localData.companies = allCompanies;

    // 4. Fetch API data for each company with credentials (PARALLEL)
    const companyPromises = customCompanies.map(async (customCo) => {
        let apiSales = [];
        let apiCampaigns = [];

        // Try Pipefy
        if (customCo.pipefyToken && customCo.pipefyPipeId) {
            try {
                const isApolar = customCo.name?.toUpperCase().includes('APOLAR') || customCo.pipefyPipeId === '305634232';
                const isAndar = customCo.name?.toUpperCase().includes('ANDAR');

                // Hardcoded overrides
                const apolarConfig = isApolar ? {
                    wonPhase: 'Contrato Assinado (Ganho)',
                    lostPhase: 'Perdido',
                    qualifiedPhase: 'Em Contato',
                    valueField: 'Valor mensal dos honorários administrativos',
                    lossReasonField: 'Proposta Enviada'
                } : {};

                const andarConfig = isAndar ? {
                    lossReasonField: 'Motivo' // Common substring for "Motivo de Perda" or "Motivo do Descarte"
                } : {};

                const pipefySales = await fetchPipefyDeals(
                    customCo.pipefyOrgId,
                    customCo.pipefyPipeId,
                    customCo.pipefyToken,
                    {
                        wonPhase: customCo.wonPhase || apolarConfig.wonPhase,
                        wonPhaseId: customCo.wonPhaseId,
                        lostPhase: customCo.lostPhase || apolarConfig.lostPhase,
                        lostPhaseId: customCo.lostPhaseId,
                        qualifiedPhase: apolarConfig.qualifiedPhase,
                        qualifiedPhaseId: customCo.qualifiedPhaseId,
                        valueField: apolarConfig.valueField,
                        lossReasonField: customCo.lossReasonField || andarConfig.lossReasonField || apolarConfig.lossReasonField
                    }
                );
                apiSales = pipefySales.map(s => ({ ...s, companyId: customCo.id }));
            } catch (e) {
                console.warn(`Failed to load Pipefy data for company ${customCo.id}`, e);
            }
        }

        // Try Meta Ads
        if (customCo.metaToken && customCo.metaAdAccountId) {
            try {
                const metaCampaigns = await fetchMetaCampaigns(customCo.metaAdAccountId, customCo.metaToken);
                apiCampaigns = metaCampaigns.map(c => ({ ...c, companyId: customCo.id }));
            } catch (e) {
                console.warn(`Failed to load Meta data for company ${customCo.id}`, e);
            }
        }

        return {
            companyId: customCo.id,
            sales: apiSales,
            campaigns: apiCampaigns
        };
    });

    const results = await Promise.all(companyPromises);

    // Merge results into localData
    results.forEach(({ companyId, sales, campaigns }) => {
        if (sales.length > 0) {
            localData.sales = localData.sales.filter(s => s.companyId !== companyId).concat(sales);
        }
        if (campaigns.length > 0) {
            localData.campaigns = localData.campaigns.filter(c => c.companyId !== companyId).concat(campaigns);
        }
    });

    return localData;
}

export function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
