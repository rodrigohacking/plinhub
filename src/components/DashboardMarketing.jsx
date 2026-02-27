import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend, Cell, PieChart, Pie
} from 'recharts';
import { DollarSign, UserPlus, Target, MousePointer, TrendingUp, Filter, Instagram, Globe, Search, Users, Ban, CircleDollarSign, PieChart as PieChartIcon, Leaf, RefreshCw, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { KPICard } from './KPICard';
import { formatCurrency, formatNumber, formatPercent, cn } from '../lib/utils';
import { DateRangeFilter, filterByDateRange, isDateInSelectedRange } from './DateRangeFilter';

export function DashboardMarketing({ company, data, onRefresh, dateRange, setDateRange }) {
    // dateRange comes from App.jsx (global persistence)
    const [activeTab, setActiveTab] = useState('geral');
    const [creativesTab, setCreativesTab] = useState('creatives'); // 'creatives' or 'campaigns'
    const [isSyncing, setIsSyncing] = useState(false);

    // Effective campaigns — sourced exclusively from Supabase DB (via data.campaigns)
    const effectiveCampaigns = useMemo(() => {
        return (data.campaigns || []).filter(c => String(c.companyId) === String(company.id));
    }, [data.campaigns, company.id]);

    const handleSync = async () => {
        setIsSyncing(true);
        const toastId = toast.loading('Sincronizando Meta Ads + Pipefy...');

        try {
            // Sync both Meta Ads and Pipefy in parallel
            const [metaRes, pipefyRes] = await Promise.allSettled([
                fetch(`/api/sync/${company.id}/meta?days=30`, { method: 'POST' })
                    .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || r.status); })),
                fetch(`/api/sync/${company.id}/pipefy`, { method: 'POST' })
                    .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || r.status); }))
            ]);

            const metaRows = metaRes.status === 'fulfilled' ? metaRes.value.rowsUpserted : 0;
            const pipefyRows = pipefyRes.status === 'fulfilled' ? pipefyRes.value.rowsUpserted : 0;

            if (metaRes.status === 'rejected') console.warn('[Sync] Meta Ads failed:', metaRes.reason);
            if (pipefyRes.status === 'rejected') console.warn('[Sync] Pipefy failed:', pipefyRes.reason);

            const parts = [];
            if (metaRows > 0) parts.push(`${metaRows} campanhas Meta`);
            if (pipefyRows > 0) parts.push(`${pipefyRows} deals Pipefy`);

            toast.success(
                parts.length > 0
                    ? `Dados atualizados: ${parts.join(', ')}`
                    : 'Sync concluído (sem novos dados)',
                { id: toastId }
            );

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error(error);
            toast.error(`Erro ao sincronizar: ${error.message}`, { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    // Helper to get actual start/end dates from range string
    const getDateRangeValues = (range, customStart = null, customEnd = null) => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);

        const fmt = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        switch (range) {
            case 'today':
                return { since: fmt(today), until: fmt(today) };
            case 'yesterday': {
                const yest = new Date(today);
                yest.setDate(yest.getDate() - 1);
                return { since: fmt(yest), until: fmt(yest) };
            }
            case 'last-7-days':
                startDate.setDate(today.getDate() - 7);
                return { since: fmt(startDate), until: fmt(endDate) };
            case 'last-30-days':
                startDate.setDate(today.getDate() - 30);
                return { since: fmt(startDate), until: fmt(endDate) };
            case 'this-month': {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                return { since: fmt(firstDay), until: fmt(endDate) };
            }
            case 'last-month': {
                const firstDayLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastDayLast = new Date(today.getFullYear(), today.getMonth(), 0);
                return { since: fmt(firstDayLast), until: fmt(lastDayLast) };
            }
            case 'last-3-months':
                startDate.setDate(today.getDate() - 90);
                return { since: fmt(startDate), until: fmt(endDate) };
            case 'this-year': {
                const firstDayYear = new Date(today.getFullYear(), 0, 1);
                return { since: fmt(firstDayYear), until: fmt(endDate) };
            }
            case 'all-time':
                startDate.setFullYear(2023, 0, 1);
                return { since: fmt(startDate), until: fmt(endDate) };
            default:
                if (range && range.startsWith('custom:') && customStart && customEnd) {
                    return { since: customStart, until: customEnd };
                }
                startDate.setDate(today.getDate() - 30);
                return { since: fmt(startDate), until: fmt(endDate) };
        }
    };

    // AUTO-SYNC ON MOUNT & DATE CHANGE
    const syncRan = React.useRef(false);

    React.useEffect(() => {
        let isMounted = true;

        const autoSync = async () => {
            if (!company?.id) return;

            setIsSyncing(true);

            try {
                // Trigger Backend Sync ONCE (on mount) to ensure database has latest numbers
                if (!syncRan.current) {
                    syncRan.current = true;
                    try {
                        const res = await fetch(`/api/sync/${company.id}/force`, { method: 'POST' });
                        if (res.ok && onRefresh) {
                            onRefresh();
                        }
                    } catch (e) {
                        console.warn("Auto-Sync: Backend error", e);
                    }
                }
            } catch (error) {
                console.error("Auto-Sync Error:", error);
            } finally {
                if (isMounted) {
                    setIsSyncing(false);
                }
            }
        };

        const timeout = setTimeout(autoSync, 500);

        return () => {
            isMounted = false;
            clearTimeout(timeout);
        };
    }, [company.id, dateRange]); 
// Re-run when dateRange changes

    // Determine if company sells insurance products
    const isAndar = company?.name?.toLowerCase().includes('andar');
    const isInsuranceCompany = isAndar || company?.name?.toLowerCase().includes('apolar');

    // Tabs Configuration - conditional based on company type
    // 4. Product Definitions (Master List for Auto-Detection)
    const PRODUCT_DEFINITIONS = [
        { id: 'condominial', label: 'Condominial', keywords: ['condominial', 'condominio', 'predio'] },
        { id: 'rc_sindico', label: 'RC Síndico', keywords: ['sindico', 'síndico', 'rc sindico'] },
        { id: 'automovel', label: 'Automóvel', keywords: ['auto', 'automovel', 'automóvel', 'carro'] },
        { id: 'residencial', label: 'Residencial', keywords: ['residencial', 'casa'] },
        { id: 'administradora', label: 'Administradora', keywords: ['administradora', 'gestao', 'gestão'] },
        { id: 'vida', label: 'Vida', keywords: ['vida', 'seguro vida'] },
        { id: 'empresarial', label: 'Empresarial', keywords: ['empresa', 'empresarial', 'pme'] }
    ];

    // Helper: Normalize Text for Matching
    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

    // Dynamic Product Detection based on Keywords in Campaign Names
    const detectedProducts = useMemo(() => {
        const found = new Set();
        const campaignNames = effectiveCampaigns.map(c => normalize(c.name || ''));

        PRODUCT_DEFINITIONS.forEach(prod => {
            if (campaignNames.some(name => prod.keywords.some(kw => name.includes(normalize(kw))))) {
                found.add(prod.id);
            }
        });

        return Array.from(found);
    }, [effectiveCampaigns]);

    // Tabs Configuration - Dynamic based on active products
    const TABS = useMemo(() => {
        const base = [{ id: 'geral', label: 'Geral', color: 'blue' }];
        const colors = ['indigo', 'purple', 'rose', 'emerald', 'amber', 'cyan', 'pink', 'orange', 'violet', 'teal'];
        
        detectedProducts.forEach((prodId, index) => {
            const def = PRODUCT_DEFINITIONS.find(d => d.id === prodId);
            if (def) {
                base.push({
                    id: def.id,
                    label: def.label,
                    color: colors[index % colors.length]
                });
            }
        });

        return base;
    }, [detectedProducts]);

    // Calculation Engine
    const metrics = useMemo(() => {
        // Map dynamic products to their keywords
        const productMapping = {};
        PRODUCT_DEFINITIONS.forEach(prod => {
            productMapping[prod.id] = { 
                dbLabel: prod.id, 
                keywords: prod.keywords.map(kw => normalize(kw))
            };
        });

        const activeScope = productMapping[activeTab];

        let targetSum = { investment: 0, sales: 0, leads: 0, revenue: 0 };
        let weightedCplSum = 0; // To calculate average CPL target

        // 2. Fetch Targets (Metas)
        if (activeTab === 'geral') {
            // For insurance companies: Sum of specific 4 products
            // For non-insurance companies: Use 'all' label directly
            if (true) { // Enable dynamic summing for all
                const products = Array.from(new Set([...detectedProducts, 'condominial', 'rc_sindico', 'automovel', 'residencial']));

                products.forEach(pKey => {
                    const pConfig = productMapping[pKey];
                    if (!pConfig) return;

                    // Find latest metric for this product
                    const row = (data.metrics || [])
                        .filter(m => String(m.companyId) === String(company.id) && m.label === pConfig.dbLabel)
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .pop() || {};

                    targetSum.investment += (row.spend || 0);
                    targetSum.sales += (row.cardsConverted || 0);

                    // Calculate leads target for this product
                    const pInvest = row.spend || 0;
                    const pCpc = row.cpc || 0;
                    const pLeads = (pInvest && pCpc) ? Math.round(pInvest / pCpc) : (row.cardsCreated || 0);
                    targetSum.leads += pLeads;
                });

                // Average Target CPL (Weighted)
                // Target CPL = Total Target Investment / Total Target Leads
                weightedCplSum = targetSum.leads > 0 ? targetSum.investment / targetSum.leads : 0;
            } else {
                // Non-insurance company: Use 'all' label
                const row = (data.metrics || [])
                    .filter(m => String(m.companyId) === String(company.id) && m.label === 'all' && m.source === 'manual')
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .pop() || {};

                targetSum.investment = row.spend || 0;
                targetSum.sales = row.cardsConverted || 0;
                const pCpc = row.cpc || 0;
                targetSum.leads = (targetSum.investment && pCpc) ? Math.round(targetSum.investment / pCpc) : (row.cardsCreated || 0);
                weightedCplSum = pCpc;
            }

            // OVERRIDE: Prioritize Explicit Sales Goals (from Forms/LocalStorage) for 'geral'
            if (activeTab === 'geral' && data.goals) {
                const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
                const salesGoal = data.goals.find(g => String(g.companyId) === String(company.id) && g.month === currentMonth);

                if (salesGoal) {
                    // Force the explicit goals set in "Definir Metas"
                    if (salesGoal.deals) targetSum.sales = salesGoal.deals;
                    if (salesGoal.leads) targetSum.leads = salesGoal.leads;
                    if (salesGoal.revenue) targetSum.revenue = salesGoal.revenue;
                }
            }

        } else {
            // Specific Product
            const row = (data.metrics || [])
                .filter(m => String(m.companyId) === String(company.id) && m.label === activeScope?.dbLabel)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .pop() || {};

            targetSum.investment = row.spend || 0;
            targetSum.sales = row.cardsConverted || 0;
            const pCpc = row.cpc || 0;
            targetSum.leads = (targetSum.investment && pCpc) ? Math.round(targetSum.investment / pCpc) : (row.cardsCreated || 0);
            weightedCplSum = pCpc;
        }

        const targets = {
            investment: targetSum.investment,
            cpl: weightedCplSum,
            leads: targetSum.leads,
            sales: targetSum.sales,
            revenue: targetSum.revenue || 0
        };

        // 3. Calculate Realized (Actuals)
        // A. Pipefy Data (Leads & Sales)
        const companySales = data.sales.filter(s => String(s.companyId) === String(company.id));
        const filteredByDate = filterByDateRange(companySales, dateRange, 'createdAt'); // for Leads
        const filteredByDateClosed = filterByDateRange(companySales, dateRange, 'date'); // for Sales

        // Product Filter Logic
        const filterByProduct = (deals) => {
            if (activeTab === 'geral') {
                // Return ALL deals for Geral to ensure everything is counted
                return deals;
            } 
            
            const scope = productMapping[activeTab];
            if (!scope) return deals;
            
            const keywords = scope.keywords || [];
            return deals.filter(d => {
                const type = normalize(d.insuranceType || d.product || '');
                return keywords.some(kw => type.includes(kw));
            });
        };

        // META ADS Filter Logic - Apply to ALL tabs (Aggregated Definition)
        const filterByMetaAds = (deals) => {
            return deals.filter(d => {
                const hasMetaTag = d.labels?.some(label =>
                    label?.toUpperCase().includes('META ADS') ||
                    label?.toUpperCase() === 'META ADS'
                );

                // Robust Check: Also check UTMs if label is missing
                const hasUtmMeta = [d.utm_source, d.utm_medium, d.utm_campaign].some(val => {
                    const v = (val || '').toLowerCase();
                    return v.includes('meta') || v.includes('facebook') || v.includes('instagram');
                });

                return hasMetaTag || hasUtmMeta;
            });
        };

        // Apply both product and META ADS filters
        // DATA PROCESSING: The API returns Daily Aggregates (Metric Rows), NOT individual deals!
        // We must SUM the values, not count the rows.

        // 1. Filter Metrics by Date Range
        // Use the imported helper which handles 'this-month', 'last-7-days' strings strings correctly
        const metricsInRange = filterByDateRange(data.metrics || [], dateRange, 'date');

        // 2. Filter by Meta Ads Label (User Request: "tag do meta")
        const metaMetrics = metricsInRange.filter(m =>
            (m.label === 'META ADS') ||
            (m.label === 'Meta Ads')
        );

        // 4. Filter Campaigns by Active Tab (Scope)
        const activeScopeResolved = activeTab === 'geral' ? null : productMapping[activeTab];

        // 3. Sum Totals


        // Re-populate wonDeals (List) using the EXACT SAME LOGIC as the "Vendas" Card
        // A. Filter Won Deals by 'won_date' (real policy closing date) if available
        const wonDealsRaw = (data.sales || []).filter(s => {
            const isCurrentCompany = String(s.companyId) === String(company.id);
            const pName = (s.phaseName || '').toLowerCase();
            const normP = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const normPhase = normP(pName);

            const isWon = (
                normPhase.includes('ganho') || 
                normPhase.includes('fechado') || 
                normPhase.includes('fechada') ||
                normPhase.includes('enviado ao cliente') || 
                normPhase.includes('apolice fechada') ||
                normPhase.includes('fechamento - ganho') ||
                s.status === 'won'
            );

            // Use won_date (snake_case) if exists, fallback to date
            const effectiveDate = s.won_date ? new Date(s.won_date) : 
                               (s.wonDate ? new Date(s.wonDate) : new Date(s.date));
            const inRange = isDateInSelectedRange(effectiveDate, dateRange);

            // Filter by Meta Ads tag for Marketing Dashboard ROI accuracy
            const hasMeta = s.labels?.some(l => {
                const labelName = normalize(typeof l === 'string' ? l : (l?.name || ''));
                return labelName.includes('meta ads');
            });

            return isCurrentCompany && isWon && inRange && hasMeta;
        });

        // Apply product filter to won deals based on active tab
        const wonDeals = filterByProduct(wonDealsRaw);

        // 4. Final Calculation (PURELY FROM LIST - BYPASSING AGGREGATES)
        // User Request: "Leads Gerados (tag meta) - Perdidos = Leads Qualificados"
        // We use COHORT LOGIC: Count leads CREATED in the period, and check IF they are lost.
        // This ensures consistent data (Created 20 - Lost 5 = Qualified 15).

        // A. Leads Created (Meta)
        const leadsList = (data.sales || []).filter(s => {
            // Strict Meta Check (Labels ONLY - User Request)
            const hasMeta = s.labels?.some(l => l?.toUpperCase().includes('META ADS') || l?.toUpperCase() === 'META ADS');

            // Use createdAt for "Leads Generated"
            const inRange = isDateInSelectedRange(s.createdAt || s.date, dateRange);
            return hasMeta && inRange;
        });

        // B. Leads Lost (Meta - Subset of Created)
        // User Request: Strict adherence to "Perdido" status for these leads.
        const lostList = leadsList.filter(s => {
            const pName = (s.phaseName || '').toLowerCase();
            const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const normPhase = normalize(pName);

            // Strict Status Check (Phase ID or Name)
            // IDs: 338889931 (Andar Lose)
            const isLost = s.status === 'lost' ||
                ['338889931'].includes(String(s.phaseId)) ||
                normPhase.includes('perdido') ||
                normPhase.includes('cancelado') ||
                normPhase.includes('descarte') ||
                normPhase.includes('recusado') ||
                normPhase.includes('invalido');

            return isLost;
        });

        const totalCreated = leadsList.length; // Use List Count
        const totalLost = lostList.length;     // Use List Count
        const leadsRealized = totalCreated;

        const salesRealized = wonDeals.length;
        const salesVolume = wonDeals.reduce((acc, d) => acc + d.amount, 0);





        // B. Investment Realized (Meta Ads) - Strict Filtering
        let investmentRealized = 0;
        let adsLeads = 0;
        let impressions = 0;
        let clicks = 0;

        // NEW STRATEGY: Campaign-Based Calculation (Lifetime / Live Data)
        // User requested to calculate Investment iterating over 'effectiveCampaigns' (which contains dailyInsights)
        // instead of 'data.metrics' (Metric table). This avoids DB Sync gaps and allows Name-based filtering.

        // NEW STRATEGY: Iterate effectiveCampaigns (merged DB + Live)
        const relevantCampaigns = effectiveCampaigns.filter(c => String(c.companyId) === String(company.id));
        console.log(`[DashboardMarketing] ${company.name} - Relevant Campaigns:`, relevantCampaigns.length);

        relevantCampaigns.forEach(campaign => {
            // 1. Check Product Scope
            let isProductMatch = false;
            const cName = normalize(campaign.name || '');

            if (activeTab === 'geral') {
                isProductMatch = true;
            } else if (activeScopeResolved) {
                const keywords = activeScopeResolved.keywords;
                if (keywords.some(kw => cName.includes(kw))) {
                    isProductMatch = true;
                }
            }

            if (isProductMatch) {
                // Remove redundant date check: the LIVE API already filters insights by date range.
                // Keeping this check here would exclude campaigns that started BEFORE the range
                // but had spend/leads WITHIN the range.
                
                investmentRealized += parseFloat(campaign.investment || 0);
                impressions += parseFloat(campaign.impressions || 0);
                clicks += parseFloat(campaign.clicks || 0);
                adsLeads += parseFloat(campaign.leads || 0);
            }
        });

        // 4. KPIs
        // CPL Realized: Use Ads Leads if > 0, otherwise fallback to Pipefy Leads (safety) but prompt requested Ads Data.
        // If we have 0 ads leads, prevent Infinity.
        const effectiveLeads = adsLeads; // User Request: "leads do proprio meta" (Sync with Meta)

        // Correct Calculation: Displayed Leads (Meta) - Displayed Lost (Pipefy)
        const qualifiedRealized = Math.max(0, effectiveLeads - totalLost);


        // DEBUG LOGGING (Moved here to have access to final vars)
        console.log(`[KPI DEBUG] Calculation (${dateRange.label}):`);
        console.log(`- Meta Effective Leads: ${effectiveLeads}`);
        console.log(`- Pipefy Lost: ${totalLost}`);
        console.log(`- Qualified: ${qualifiedRealized}`);


        const cplRealized = effectiveLeads > 0 ? investmentRealized / effectiveLeads : 0;

        // ROI: (Volume Vendas - Investimento) / Investimento
        let roi = investmentRealized > 0 ? ((salesVolume - investmentRealized) / investmentRealized) * 100 : 0;
        let roiMultiplier = investmentRealized > 0 ? (salesVolume / investmentRealized) : 0;

        // Percentages
        const investmentPrc = targets.investment ? (investmentRealized / targets.investment) * 100 : 0;
        const cplPrc = targets.cpl ? (cplRealized / targets.cpl) * 100 : 0;

        // Conversion Rate: Sales / Leads * 100
        const conversionRate = effectiveLeads > 0 ? (salesRealized / effectiveLeads) * 100 : 0;

        return {
            targets,
            realized: {
                investment: investmentRealized,
                leads: effectiveLeads, // Using Pipefy List count
                qualified: qualifiedRealized,
                lost: totalLost, // Consistent Robust Calculation
                sales: salesRealized,
                cpl: cplRealized,
                volume: salesVolume,
                cac: salesRealized > 0 ? (investmentRealized / salesRealized) : 0,
                roi: roiMultiplier, // Sending Multiplier
                conversionRate: conversionRate,
                impressions,
                clicks
            },
            roi,
            investmentPrc,
            cplPrc,
            wonDeals, // Expose for product table usage
            leadsList // Expose for product efficiency usage
        };

    }, [data, company.id, dateRange, activeTab]);

    const { targets, realized, roi, investmentPrc, cplPrc, wonDeals, leadsList } = metrics;

    // C. Product/Insurance Efficiency
    // Group leads by product keywords (from campaign name)
    // Group sales by the NEW 'product' column
    const productStats = {};
    const campaignsList = effectiveCampaigns.filter(c => String(c.companyId) === String(company.id)); // Assuming effectiveCampaigns is available

    // 1. Group Active Leads by Campaign Tags
    leadsList.forEach(lead => {
        const campaign = campaignsList.find(c => c.id === lead.campaign_id);
        const cName = campaign?.name || '';
        let productKey = 'Outros';

        // Use defined products for grouping
        PRODUCT_DEFINITIONS.forEach(def => {
            if (cName.toLowerCase().includes(normalize(def.label)) || def.keywords.some(kw => cName.toLowerCase().includes(normalize(kw)))) {
                productKey = def.label;
            }
        });

        if (!productStats[productKey]) {
            productStats[productKey] = { name: productKey, leads: 0, sales: 0, volume: 0 };
        }
        productStats[productKey].leads++;
    });

    // 2. Group Won Deals by ACTUAL product column
    wonDeals.forEach(deal => {
        let pName = deal.product || 'Outros';

        // Normalize product names to match keys
        if (pName.toLowerCase().includes('condomin')) pName = 'Condominial';
        else if (pName.toLowerCase().includes('sindico')) pName = 'RC Síndico';
        else if (pName.toLowerCase().includes('auto')) pName = 'Automóvel';
        else if (pName.toLowerCase().includes('residenc')) pName = 'Residencial';
        else if (pName.toLowerCase().includes('vida')) pName = 'Vida';

        if (!productStats[pName]) {
            productStats[pName] = { name: pName, leads: 0, sales: 0, volume: 0 };
        }
        productStats[pName].sales++;
        productStats[pName].volume += deal.amount;
    });

    // 3. Convert to array and sort
    const productEfficiency = Object.values(productStats)
        .sort((a, b) => b.volume - a.volume); // Sort by volume for product efficiency

    // Top Performers Logic (UTM based)
    const topPerformers = useMemo(() => {
        const type = creativesTab === 'creatives' ? 'utm_content' : 'utm_campaign';

        // 1. Use wonDeals (Total 88) but FILTER strictly by Tag for this chart
        // User Request: "só quero vendas que tenham a tag META ADS"
        const relevantSales = (metrics.wonDeals || []).filter(d =>
            d.labels?.some(label =>
                label?.toUpperCase().includes('META ADS') ||
                label?.toUpperCase() === 'META ADS'
            )
        );

        // 2. Aggregate
        const stats = {};
        relevantSales.forEach(s => {
            // Get raw UTM value
            let key = s[type];

            // Clean up common pipefy artifacts if present (e.g. ["value"])
            if (key && typeof key === 'string') {
                if (key.startsWith('["') && key.endsWith('"]')) {
                    key = key.replace('["', '').replace('"]', '');
                }
            }

            if (!key) key = 'Não Identificado'; // Include deals without UTMs

            if (!stats[key]) {
                stats[key] = { name: key, count: 0, revenue: 0 };
            }
            stats[key].count += 1;
            stats[key].revenue += (s.amount || 0);
        });

        // 3. Convert to array and sort
        return Object.values(stats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5); // Top 5
    }, [data, company.id, dateRange, creativesTab]);

    // Animation Variants
    const tabVariants = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.2 }
    };

    return (
        <div className="space-y-8 pb-12 w-full max-w-full overflow-x-hidden">
            {/* 1. Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Marketing Performance</h2>
                    <p className="text-gray-500 dark:text-gray-400">Acompanhamento estratégico de campanhas e conversão</p>
                </div>
                <div className="flex items-center gap-3">

                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                </div>
            </div>

            {/* 2. Tabs Navigation */}
            <div className="flex flex-wrap gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl w-full md:w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200",
                            activeTab === tab.id
                                ? "bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode='wait'>
                <motion.div
                    key={activeTab}
                    variants={tabVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="space-y-6"
                >

                    {/* BLOCK 1: PERFORMANCE (ROI Highlight) */}
                    <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold mb-1">Retorno sobre Investimento</h3>
                                <p className="text-slate-400">{activeTab === 'geral' ? 'Geral' : TABS.find(t => t.id === activeTab)?.label} ROI</p>
                            </div>
                            <div className="text-right">
                                <span className={cn("text-5xl font-black tracking-tighter", roi >= 0 ? "text-emerald-400" : "text-red-400")}>
                                    {roi > 0 ? '+' : ''}{formatNumber(roi.toFixed(0))}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ADDITIONAL METRICS - Show in Geral tab for all companies */}
                    {activeTab === 'geral' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-4">
                            {/* Investimento */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="w-5 h-5 text-red-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">Investimento</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate" title={formatCurrency(realized.investment)}>
                                    {formatCurrency(realized.investment)}
                                </p>
                            </div>

                            {/* Leads Gerados */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <UserPlus className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">Leads</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate" title={formatNumber(realized.leads)}>
                                    {formatNumber(realized.leads)}
                                </p>
                            </div>

                            {/* Leads Orgânicos */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Leaf className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">Leads Orgânicos</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate">
                                    {(() => {
                                        const organicLeads = data?.sales?.filter(s => {
                                            const isCurrentCompany = String(s.companyId) === String(company.id);
                                            const isInRange = filterByDateRange([s], dateRange, 'createdAt').length > 0;
                                            const hasOrganicTag = s.labels?.some(label =>
                                                label?.toUpperCase().includes('ORGÂNICO IG')
                                            );
                                            return isCurrentCompany && isInRange && hasOrganicTag;
                                        }).length || 0;
                                        return formatNumber(organicLeads);
                                    })()}
                                </p>
                            </div>

                            {/* Custo por Lead */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Target className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">CPL</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate" title={formatCurrency(realized.cpl)}>
                                    {formatCurrency(realized.cpl)}
                                </p>
                            </div>

                            {/* CAC */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users className="w-5 h-5 text-pink-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">CAC</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate">
                                    {(() => {
                                        const metaSales = data?.sales?.filter(s => {
                                            const isCurrentCompany = String(s.companyId) === String(company.id);
                                            const isInRange = filterByDateRange([s], dateRange, 'wonDate').length > 0;

                                            // Robust Won Check
                                            const pName = s.phaseName ? s.phaseName.toLowerCase() : '';
                                            const isWon = s.status === 'won' ||
                                                ['338889923', '338889934', '341604257'].includes(String(s.phaseId)) ||
                                                pName.includes('ganho') || pName.includes('fechado') || pName.includes('enviado ao cliente');

                                            // Robust Meta Check (Labels + UTMs)
                                            const hasMetaTag = s.labels?.some(label =>
                                                label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                            ) || [s.utm_source, s.utm_medium, s.utm_campaign].some(val => {
                                                const v = (val || '').toLowerCase();
                                                return v.includes('meta') || v.includes('facebook') || v.includes('instagram');
                                            });

                                            return isCurrentCompany && isInRange && isWon && hasMetaTag;
                                        }).length || 0;

                                        return metaSales > 0 ? formatCurrency(realized.investment / metaSales) : formatCurrency(0);
                                    })()}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1 truncate">Custo Aquisição</p>
                            </div>

                            {/* Vendas (Meta) */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Instagram className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">Vendas</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate">
                                    {data?.sales?.filter(s => {
                                        const isCurrentCompany = String(s.companyId) === String(company.id);
                                        const isInRange = filterByDateRange([s], dateRange, 'wonDate').length > 0;

                                        // Robust Won Check
                                        const pName = s.phaseName ? s.phaseName.toLowerCase() : '';
                                        const isWon = s.status === 'won' ||
                                            ['338889923', '338889934', '341604257'].includes(String(s.phaseId)) ||
                                            pName.includes('ganho') || pName.includes('fechado') || pName.includes('enviado ao cliente');

                                        // Robust Meta Check (Labels + UTMs)
                                        const hasMetaTag = s.labels?.some(label =>
                                            label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                        ) || [s.utm_source, s.utm_medium, s.utm_campaign].some(val => {
                                            const v = (val || '').toLowerCase();
                                            return v.includes('meta') || v.includes('facebook') || v.includes('instagram');
                                        });

                                        return isCurrentCompany && isInRange && isWon && hasMetaTag;
                                    }).length || 0}
                                </p>
                            </div>

                            {/* ROI */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3 overflow-hidden">
                                    <TrendingUp className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase whitespace-normal leading-tight">Retorno sobre Invest.</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate" title={`${(realized.roi || 0).toFixed(1)}x`}>
                                    {(realized.roi || 0).toFixed(1)}x
                                </p>
                            </div>

                            {/* Taxa de Conversão */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3 overflow-hidden">
                                    <Activity className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase whitespace-normal leading-tight">Taxa de Conversão</p>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate" title={`${(realized.conversionRate || 0).toFixed(1)}%`}>
                                        {(realized.conversionRate || 0).toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            {/* Leads Perdidos */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Ban className="w-5 h-5 text-red-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">Perdidos</p>
                                </div>
                                <p className="text-3xl font-black text-red-500">
                                    {realized.lost}
                                </p>
                                <p className="text-xs text-red-400 mt-1">
                                    Churn: {realized.leads > 0 ? ((realized.lost / realized.leads) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Grid wrapper for Funil & Top Criativos - ONLY VISIBLE IN GERAL TAB */}
                    {activeTab === 'geral' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Funil de Conversão */}
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                                        <Filter className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Funil de Conversão</h3>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Eficiência de cada etapa do marketing</p>

                                <div className="space-y-4">
                                    {/* Impressões */}
                                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Impressões</span>
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(realized.impressions || 0)}</span>
                                    </div>

                                    {/* Cliques */}
                                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Cliques</span>
                                            <span className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(realized.clicks || 0)}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1 text-right">
                                            CTR: {realized.impressions > 0 ? ((realized.clicks / realized.impressions) * 100).toFixed(2) : 0}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Top Criativos */}
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg text-pink-600">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Top Criativos</h3>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Anúncios que geraram receita</p>

                                <div className="flex gap-4 mb-6">
                                    <button
                                        onClick={() => setCreativesTab('creatives')}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                            creativesTab === 'creatives'
                                                ? "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-b-2 border-blue-500"
                                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                                        )}
                                    >
                                        Criativos
                                    </button>
                                    <button
                                        onClick={() => setCreativesTab('campaigns')}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                            creativesTab === 'campaigns'
                                                ? "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-b-2 border-blue-500"
                                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                                        )}
                                    >
                                        Campanhas
                                    </button>
                                </div>

                                {topPerformers.length > 0 ? (
                                    <div className="space-y-4">
                                        {topPerformers.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-white/10 rounded-full font-bold text-sm text-gray-500">
                                                        #{index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1" title={item.name}>
                                                            {item.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400">{item.count} venda{item.count !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <p className="font-bold text-emerald-600 text-sm whitespace-nowrap">
                                                    {formatCurrency(item.revenue)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-6 flex flex-col items-center justify-center h-32 bg-gray-50 dark:bg-white/5 rounded-xl">
                                        <Instagram className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                                        <p className="text-sm text-gray-400 dark:text-gray-500">
                                            {creativesTab === 'creatives'
                                                ? 'Nenhum criativo com vendas no período'
                                                : 'Nenhuma campanha com vendas no período'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* BLOCK 2: INVESTIMENTO */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Investimento & Resultados</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                                {/* Meta vs Realizado - Investimento */}
                                <div className="col-span-2 flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Investimento Realizado</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(realized.investment)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Meta</p>
                                        <p className="text-xl font-bold text-gray-500">{formatCurrency(targets.investment)}</p>
                                    </div>
                                    <div className="text-right pl-4 border-l border-gray-200 dark:border-white/10">
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Atingimento</p>
                                        <span className={cn("text-lg font-black", investmentPrc > 100 ? "text-red-500" : "text-emerald-500")}>
                                            {investmentPrc.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Leads */}
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Leads Gerados</p>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white">{realized.leads}</p>
                                    <p className="text-xs text-gray-400 mt-1">Meta: {targets.leads}</p>
                                </div>

                                {/* Vendas */}
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Vendas Fechadas</p>
                                    <p className="text-3xl font-black text-emerald-600">{realized.sales}</p>
                                    <p className="text-xs text-gray-400 mt-1">Meta: {targets.sales}</p>
                                </div>

                                {/* Qualificados */}
                                <div className="col-span-2 pt-4 border-t border-gray-100 dark:border-white/5">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Leads Qualificados</p>
                                        <p className="text-xl font-black text-purple-600 dark:text-purple-400">{realized.qualified}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BLOCK 3: EFICIÊNCIA (CPL) */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                                    <Target className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Eficiência (CPL)</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {/* CPL Gauge / Comparison */}
                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">CPL Realizado</p>
                                        <p className="text-3xl font-black text-gray-900 dark:text-white">{formatCurrency(realized.cpl)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Meta CPL</p>
                                        <p className="text-xl font-bold text-gray-500">{formatCurrency(targets.cpl)}</p>
                                    </div>
                                </div>

                                {/* Volume Vendas */}
                                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-white/5">
                                    <p className="text-xs font-bold text-emerald-600/70 uppercase mb-2">
                                        {company?.name?.toLowerCase().includes('apolar') ? 'Volume Total em Contratos' : 'Volume Total em Apólices'}
                                    </p>
                                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(realized.volume)}</p>
                                    <p className="text-xs text-emerald-600/60 mt-1">Meta: {formatCurrency(targets.revenue)}</p>
                                </div>

                                {/* Atingimento Text */}
                                <div className="pt-2">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-500">Atingimento da Meta de Custo</span>
                                        <span className={cn("font-bold", realized.cpl <= targets.cpl ? "text-emerald-500" : "text-red-500")}>
                                            {targets.cpl ? ((realized.cpl / targets.cpl) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full", realized.cpl <= targets.cpl ? "bg-emerald-500" : "bg-red-500")}
                                            style={{ width: `${Math.min(targets.cpl ? (realized.cpl / targets.cpl) * 100 : 0, 100)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        {realized.cpl <= targets.cpl ? "Dentro da meta! 🚀" : "Acima da meta (Atenção) ⚠️"}
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Placeholder for future detailed charts */}
                    <div className="text-center text-xs text-gray-400 pt-8 opacity-50">
                        Dados filtrados para: {TABS.find(t => t.id === activeTab)?.label}
                    </div>

                </motion.div >
            </AnimatePresence >
        </div >
    );
}
