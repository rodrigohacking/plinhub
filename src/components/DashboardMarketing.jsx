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

export function DashboardMarketing({ company, data, onRefresh }) {
    const [dateRange, setDateRange] = useState('this-month');
    const [activeTab, setActiveTab] = useState('geral');
    const [creativesTab, setCreativesTab] = useState('creatives'); // 'creatives' or 'campaigns'
    const [isSyncing, setIsSyncing] = useState(false);
    // Live Overlay State
    const [liveCampaigns, setLiveCampaigns] = useState([]);

    // Calculate effective campaigns (Merge DB + Live)
    const effectiveCampaigns = useMemo(() => {
        const dbCampaigns = data.campaigns || [];

        // Helper to normalize date to YYYY-MM-DD
        const normDate = (d) => {
            if (!d) return '';
            return typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);
        };

        // 1. Convert DB Campaigns to Map
        const campaignMap = new Map();
        dbCampaigns.forEach(c => {
            if (String(c.companyId) === String(company.id)) {
                // Key by Name + StartDate (Normalized)
                const key = `${c.name}-${normDate(c.startDate)}`;
                campaignMap.set(key, c);
            }
        });

        // 2. Overlay Live Campaigns
        if (liveCampaigns.length > 0) {
            liveCampaigns.forEach(c => {
                const rawDate = c.date_start || c.date;
                const dateStr = normDate(rawDate);
                // DEBUG LOG
                console.log(`[MarketingDebug] Live Campaign: ${c.campaign_name} | Raw: ${rawDate} | Norm: ${dateStr} | Invest: ${c.spend}`);

                const formatted = {
                    id: `live_${c.campaign_id}_${dateStr}`,
                    companyId: company.id,
                    name: c.campaign_name,
                    startDate: dateStr,
                    endDate: normDate(c.date_stop || c.date), // Use stop date or fallback
                    investment: Number(c.spend || 0),
                    impressions: Number(c.impressions || 0),
                    clicks: Number(c.clicks || 0),
                    leads: Number(c.leads || 0),
                    channel: 'Meta Ads (Live)'
                };

                // Override if exists
                const key = `${formatted.name}-${dateStr}`;
                campaignMap.set(key, formatted);
            });
        }

        return Array.from(campaignMap.values());
    }, [data.campaigns, liveCampaigns, company.id]);

    // State for Live Data (Transient)



    const handleSync = async () => {
        setIsSyncing(true);
        const toastId = toast.loading('Sincronizando dados com Meta Ads e Pipefy...');

        try {
            // 1. Force Backend Sync (Database Update)
            const res = await fetch(`/api/sync/${company.id}/force`, { method: 'POST' });
            if (!res.ok) throw new Error('Falha na sincronização');

            // 2. Fetch Live Data immediately (Hotfix for freshness) - LIFETIME (365 days)
            try {
                const liveRes = await fetch(`/api/integrations/${company.id}/meta/live?days=365`);
                if (liveRes.ok) {
                    const liveData = await liveRes.json();
                    if (liveData.success && liveData.data) {
                        console.log("Live Meta Data Fetched:", liveData.data.length);
                        setLiveCampaigns(liveData.data); // Update State
                    }
                }
            } catch (e) {
                console.warn("Live fetch warning:", e);
            }

            toast.success('Dados atualizados com sucesso!', { id: toastId });

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro ao sincronizar. Tente novamente.', { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    // AUTO-SYNC ON MOUNT (Replaces Manual Button)
    const syncRan = React.useRef(false);
    const toastIdRef = React.useRef(null);

    React.useEffect(() => {
        let isMounted = true;

        const autoSync = async () => {
            if (!company?.id) return;

            // Prevent double run
            if (syncRan.current) return;
            syncRan.current = true;

            // Avoid duplicate strict syncs if already syncing
            if (isSyncing) return;

            setIsSyncing(true);
            const toastId = toast.loading('Atualizando dados do Meta Ads e Pipefy...', { duration: Infinity }); // Persistent until done
            toastIdRef.current = toastId;

            try {
                console.log("Auto-Sync: Iniciando atualização...");

                // 1. Force Backend Sync (Database Update - 90 days window)
                const res = await fetch(`/api/sync/${company.id}/force`, { method: 'POST' });

                if (!res.ok) {
                    console.warn("Auto-Sync: Falha no sync do backend, tentando live fetch...");
                }

                // 2. Fetch Live Data immediately to ensure "Today" is accurate (Hotfix)
                try {
                    // Fetch 365 days of live data to compare/fill gaps if backend sync was slow
                    const liveRes = await fetch(`/api/integrations/${company.id}/meta/live?days=365`);
                    if (liveRes.ok) {
                        const liveJson = await liveRes.json();
                        if (liveJson.success && Array.isArray(liveJson.data)) {
                            console.log("Live Overlay Applied:", liveJson.data.length, "records");
                            if (isMounted) setLiveCampaigns(liveJson.data);
                        }
                    }
                } catch (e) {
                    console.warn("Auto-Sync: Live fetch warning:", e);
                }

                if (isMounted) {
                    toast.dismiss(toastId);
                    toast.success('Dados atualizados!', { duration: 2000 });
                    if (onRefresh) onRefresh();
                }
            } catch (error) {
                console.error("Auto-Sync Error:", error);
                if (isMounted) {
                    toast.dismiss(toastId);
                    toast.error('Erro na atualização automática.');
                }
            } finally {
                if (isMounted) setIsSyncing(false);
            }
        };

        autoSync();

        return () => {
            isMounted = false;
            toast.dismiss(toastIdRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [company.id]); // Run when company changes (or mounts)

    // Determine if company sells insurance products
    const isAndar = company?.name?.toLowerCase().includes('andar');
    const isInsuranceCompany = isAndar || company?.name?.toLowerCase().includes('apolar');

    // Tabs Configuration - conditional based on company type
    const TABS = isAndar ? [
        { id: 'geral', label: 'Geral', color: 'blue' },
        { id: 'condominial', label: 'Condominial', color: 'indigo' },
        { id: 'rc_sindico', label: 'RC Síndico', color: 'purple' },
        { id: 'automovel', label: 'Automóvel', color: 'rose' },
        { id: 'residencial', label: 'Residencial', color: 'emerald' }
    ] : [
        { id: 'geral', label: 'Geral', color: 'blue' }
    ];

    // Helper: Normalize Text for Matching
    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

    // Calculation Engine
    const metrics = useMemo(() => {
        // 1. Determine Product Scope
        // Map Tab ID to Database Label and Pipefy Insurance Type
        const productMapping = {
            'geral': null, // Special handling
            'condominial': { dbLabel: 'condominial', pipefyType: 'condomin', keywords: ['condominial', 'condomínio'] },
            'rc_sindico': { dbLabel: 'rc_sindico', pipefyType: 'sindico', keywords: ['sindico', 'síndico'] },
            'automovel': { dbLabel: 'automovel', pipefyType: 'auto', keywords: ['automovel', 'automóvel', 'auto'] },
            'residencial': { dbLabel: 'residencial', pipefyType: 'residencial', keywords: ['residencial'] }
        };

        let targetSum = { investment: 0, sales: 0, leads: 0, revenue: 0 };
        let weightedCplSum = 0; // To calculate average CPL target

        // 2. Fetch Targets (Metas)
        if (activeTab === 'geral') {
            // For insurance companies: Sum of specific 4 products
            // For non-insurance companies: Use 'all' label directly
            if (isInsuranceCompany) {
                const products = ['condominial', 'rc_sindico', 'automovel', 'residencial'];

                products.forEach(pKey => {
                    const pConfig = productMapping[pKey];
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
            const activeScope = productMapping[activeTab];
            const row = (data.metrics || [])
                .filter(m => String(m.companyId) === String(company.id) && m.label === activeScope.dbLabel)
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
            } else {
                const type = productMapping[activeTab].pipefyType;
                return deals.filter(d => normalize(d.insuranceType || '').includes(type));
            }
        };

        // META ADS Filter Logic - Apply to ALL tabs
        const filterByMetaAds = (deals) => {
            return deals.filter(d => {
                const hasMetaTag = d.labels?.some(label =>
                    label?.toUpperCase().includes('META ADS') ||
                    label?.toUpperCase() === 'META ADS'
                );
                return hasMetaTag;
            });
        };

        // Apply both product and META ADS filters
        const createdDealsFiltered = filterByProduct(filteredByDate);
        const createdDeals = filterByMetaAds(createdDealsFiltered);

        const wonDealsFiltered = filterByProduct(
            filteredByDateClosed.filter(d => {
                const pName = normalize(d.phaseName);
                return d.status === 'won' ||
                    ['338889923', '338889934'].includes(String(d.phaseId)) ||
                    pName.includes('enviado ao cliente') ||
                    pName.includes('apolice fechada') ||
                    pName.includes('fechamento - ganho');
            })
        );
        const wonDeals = filterByMetaAds(wonDealsFiltered);

        const lostDealsFiltered = filterByProduct(
            filteredByDate.filter(d => {
                const pName = d.phaseName ? d.phaseName.toLowerCase() : '';
                const isLost = d.status === 'lost' ||
                    ['338889931'].includes(String(d.phaseId)) ||
                    pName.includes('perdido') ||
                    pName.includes('lost');

                // DEBUG SPECIFIC: Log if lost logic is tricky
                // if (isLost) console.log(`[Dashboard Debug] Found Lost Deal: ${d.title} (${d.phaseName})`);
                return isLost;
            })
        );
        const lostDeals = filterByMetaAds(lostDealsFiltered);

        const leadsRealized = createdDeals.length;

        // USER REQUEST: Qualified = Total Leads - Lost Leads
        const qualifiedRealized = Math.max(0, leadsRealized - lostDeals.length);

        // DEBUG LOGGING FOR USER VERIFICATION
        console.log(`[KPI DEBUG] Leads Calculation for range ${dateRange}:`);
        console.log(`- Total Created (Filtered): ${leadsRealized}`);
        console.log(`- Lost (Subset of Created): ${lostDeals.length}`);
        console.log(`- Result (Qualified): ${qualifiedRealized}`);

        const salesRealized = wonDeals.length;
        const salesVolume = wonDeals.reduce((acc, d) => acc + d.amount, 0);

        // EXTRA DEBUG: Check for mismatch
        if (activeTab === 'geral') {
            console.log(`[KPI DEBUG] Detailed Breakdown:`);
            console.log(`  -> Created List Sample (Top 3):`, createdDeals.slice(0, 3).map(d => `${d.title} (${d.phaseName})`));
            console.log(`  -> Lost List Sample (Top 3):`, lostDeals.slice(0, 3).map(d => `${d.title} (${d.phaseName})`));
        }

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
            } else {
                const config = productMapping[activeTab];
                if (config && config.keywords) {
                    if (config.keywords.some(kw => cName.includes(kw))) {
                        isProductMatch = true;
                    }
                }
            }

            if (isProductMatch) {
                const inDate = isDateInSelectedRange(campaign.startDate, dateRange);
                // console.log(`[Campaign Check] ${cName} | Start: ${campaign.startDate} | InRange: ${inDate} | Invest: ${campaign.investment}`);

                if (inDate) {
                    investmentRealized += parseFloat(campaign.investment || 0);
                    impressions += parseFloat(campaign.impressions || 0);
                    clicks += parseFloat(campaign.clicks || 0);
                    adsLeads += parseFloat(campaign.leads || 0);
                }
                // Hotfix: If dateRange is 'this-month' and campaign looks recent enough?
                // Let's stick to isDateInSelectedRange.
            }
        });

        // 4. KPIs
        // CPL Realized: Use Ads Leads if > 0, otherwise fallback to Pipefy Leads (safety) but prompt requested Ads Data.
        // If we have 0 ads leads, prevent Infinity.
        const effectiveLeads = adsLeads; // User Request: "leads do proprio meta" (Sync with Meta)
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
            wonDeals // Expose wonDeals for consistency
        };

    }, [data, company.id, dateRange, activeTab]);

    const { targets, realized, roi, investmentPrc, cplPrc } = metrics;

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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-4">
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
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">Retorno sobre Invest.</p>
                                </div>
                                <p className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white truncate" title={`${(realized.roi || 0).toFixed(1)}x`}>
                                    {(realized.roi || 0).toFixed(1)}x
                                </p>
                            </div>

                            {/* Taxa de Conversão */}
                            <div className="bg-white dark:bg-[#111] p-4 lg:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <Activity className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                    <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase truncate">Taxa de Conversão</p>
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
                                    {data?.sales?.filter(s => {
                                        const isCurrentCompany = String(s.companyId) === String(company.id);
                                        const isInRange = filterByDateRange([s], dateRange, 'createdAt').length > 0;

                                        // Robust Lost Check
                                        const pName = s.phaseName ? s.phaseName.toLowerCase() : '';
                                        const isLost = s.status === 'lost' ||
                                            ['338889931'].includes(String(s.phaseId)) ||
                                            pName.includes('perdido') ||
                                            pName.includes('lost');

                                        // Strict Meta Tag Check (Match Created/Won logic)
                                        const hasMetaTag = s.labels?.some(label =>
                                            label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                        ) || [s.utm_source, s.utm_medium, s.utm_campaign].some(val => {
                                            const v = (val || '').toLowerCase();
                                            return v.includes('meta') || v.includes('facebook') || v.includes('instagram');
                                        });
                                        return isCurrentCompany && isInRange && isLost && hasMetaTag;
                                    }).length || 0}
                                </p>
                                <p className="text-xs text-red-400 mt-1">
                                    Churn: {(() => {
                                        const metaLeads = data?.sales?.filter(s => {
                                            const isCurrentCompany = String(s.companyId) === String(company.id);
                                            const isInRange = filterByDateRange([s], dateRange, 'createdAt').length > 0;
                                            const hasMetaTag = s.labels?.some(label =>
                                                label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                            );
                                            return isCurrentCompany && isInRange && hasMetaTag;
                                        }).length || 0;

                                        const metaLost = data?.sales?.filter(s => {
                                            const isCurrentCompany = String(s.companyId) === String(company.id);
                                            const isInRange = filterByDateRange([s], dateRange, 'createdAt').length > 0;

                                            // Robust Lost Check
                                            const pName = s.phaseName ? s.phaseName.toLowerCase() : '';
                                            const isLost = s.status === 'lost' ||
                                                ['338889931'].includes(String(s.phaseId)) ||
                                                pName.includes('perdido') ||
                                                pName.includes('lost');

                                            const hasMetaTag = s.labels?.some(label =>
                                                label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                            );
                                            return isCurrentCompany && isInRange && isLost && hasMetaTag;
                                        }).length || 0;

                                        return metaLeads > 0 ? ((metaLost / metaLeads) * 100).toFixed(1) : 0;
                                    })()}%
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
