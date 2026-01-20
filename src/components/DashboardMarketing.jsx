import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend, Cell, PieChart, Pie
} from 'recharts';
import { DollarSign, UserPlus, Target, MousePointer, TrendingUp, Filter, Instagram, Globe, Search, Users, Ban, CircleDollarSign, PieChart as PieChartIcon, Leaf } from 'lucide-react';
import { KPICard } from './KPICard';
import { formatCurrency, formatNumber, formatPercent, cn } from '../lib/utils';
import { DateRangeFilter, filterByDateRange } from './DateRangeFilter';

export function DashboardMarketing({ company, data }) {
    const [dateRange, setDateRange] = useState('this-month');
    const [activeTab, setActiveTab] = useState('geral');
    const [creativesTab, setCreativesTab] = useState('creatives'); // 'creatives' or 'campaigns'

    // Determine if company sells insurance products
    const isInsuranceCompany = company?.name?.toLowerCase().includes('andar');

    // Tabs Configuration - conditional based on company type
    const TABS = isInsuranceCompany ? [
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

        let targetSum = { investment: 0, sales: 0, leads: 0 };
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
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .pop() || {};

                targetSum.investment = row.spend || 0;
                targetSum.sales = row.cardsConverted || 0;
                const pCpc = row.cpc || 0;
                targetSum.leads = (targetSum.investment && pCpc) ? Math.round(targetSum.investment / pCpc) : (row.cardsCreated || 0);
                weightedCplSum = pCpc;
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
            sales: targetSum.sales
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
        const wonDeals = wonDealsFiltered;

        const qualifiedDealsFiltered = filterByProduct(
            filteredByDate.filter(d =>
                d.status === 'qualified' ||
                d.status === 'won'
            )
        );
        const qualifiedDeals = filterByMetaAds(qualifiedDealsFiltered);

        const leadsRealized = createdDeals.length;
        const qualifiedRealized = qualifiedDeals.length;
        const salesRealized = wonDeals.length;
        const salesVolume = wonDeals.reduce((acc, d) => acc + d.amount, 0);

        // B. Investment Realized (Meta Ads) - Strict Filtering
        let investmentRealized = 0;
        let adsLeads = 0;
        let impressions = 0;
        let clicks = 0;

        const companyCampaigns = data.campaigns.filter(c => String(c.companyId) === String(company.id));
        const relevantCampaigns = filterByDateRange(companyCampaigns, dateRange, 'startDate');

        relevantCampaigns.forEach(c => {
            const cName = normalize(c.name);
            let isMatch = false;

            if (activeTab === 'geral') {
                // Modified: Include ALL campaigns for Geral to avoid missing data (e.g. MST, Institucional)
                isMatch = true;
            } else {
                const keywords = productMapping[activeTab].keywords;
                if (keywords.some(k => cName.includes(k))) isMatch = true;
            }

            if (isMatch) {
                investmentRealized += c.investment || c.spend || 0;
                adsLeads += c.leads || 0;
                impressions += c.impressions || 0;
                clicks += c.clicks || 0;
            }
        });

        // 4. KPIs
        // CPL Realized: Use Ads Leads if > 0, otherwise fallback to Pipefy Leads (safety) but prompt requested Ads Data.
        // If we have 0 ads leads, prevent Infinity.
        const effectiveLeads = adsLeads;
        const cplRealized = effectiveLeads > 0 ? investmentRealized / effectiveLeads : 0;

        // ROI: (Volume Vendas - Investimento) / Investimento
        let roi = investmentRealized > 0 ? ((salesVolume - investmentRealized) / investmentRealized) * 100 : 0;
        if (roi > 9999) roi = 9999;
        if (roi < -9999) roi = -9999;

        // Percentages
        const investmentPrc = targets.investment ? (investmentRealized / targets.investment) * 100 : 0;
        const cplPrc = targets.cpl ? (cplRealized / targets.cpl) * 100 : 0; // Lower is better usually, but for goal achievement: if CPL < Target = Good.
        // Wait, "Atingimento da Meta". If Meta is 50 and Actual is 40, we are doing GOOD (under budget). If Actual is 60, Bad.
        // Conventional "Achievement" for cost: Usually (Target / Actual) or just status.
        // User asks "% de Atingimento da Meta de Custo". I will show simple comparison.

        return {
            targets,
            realized: {
                investment: investmentRealized,
                leads: adsLeads, // Updated to show Meta Ads Leads as per CPL
                qualified: qualifiedRealized,
                sales: salesRealized,
                cpl: cplRealized,
                volume: salesVolume,
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
        <div className="space-y-8 pb-12">
            {/* 1. Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Marketing Performance</h2>
                    <p className="text-gray-500 dark:text-gray-400">Acompanhamento estratégico de campanhas e conversão</p>
                </div>
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
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
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                            {/* Investimento */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="w-5 h-5 text-red-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">Investimento</p>
                                </div>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(realized.investment)}</p>
                            </div>

                            {/* Leads Gerados */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <UserPlus className="w-5 h-5 text-blue-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">Leads</p>
                                </div>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {formatNumber(realized.leads)}
                                </p>
                            </div>

                            {/* Leads Orgânicos */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Leaf className="w-5 h-5 text-green-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">Leads Orgânicos</p>
                                </div>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
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
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Target className="w-5 h-5 text-emerald-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">CPL</p>
                                </div>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(realized.cpl)}</p>
                            </div>

                            {/* CAC */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users className="w-5 h-5 text-pink-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">CAC</p>
                                </div>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {(() => {
                                        const metaSales = data?.sales?.filter(s => {
                                            const isCurrentCompany = String(s.companyId) === String(company.id);
                                            const isInRange = filterByDateRange([s], dateRange, 'wonDate').length > 0;
                                            const isWon = s.status === 'won' || ['338889923', '338889934'].includes(String(s.phaseId));
                                            const hasMetaTag = s.labels?.some(label =>
                                                label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                            );
                                            return isCurrentCompany && isInRange && isWon && hasMetaTag;
                                        }).length || 0;

                                        return metaSales > 0 ? formatCurrency(realized.investment / metaSales) : formatCurrency(0);
                                    })()}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Custo Aquisição</p>
                            </div>

                            {/* Vendas (Meta) */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Instagram className="w-5 h-5 text-purple-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">Vendas</p>
                                </div>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {data?.sales?.filter(s => {
                                        const isCurrentCompany = String(s.companyId) === String(company.id);
                                        const isInRange = filterByDateRange([s], dateRange, 'wonDate').length > 0;
                                        const isWon = s.status === 'won' || ['338889923', '338889934'].includes(String(s.phaseId));
                                        const hasMetaTag = s.labels?.some(label =>
                                            label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                        );
                                        return isCurrentCompany && isInRange && isWon && hasMetaTag;
                                    }).length || 0}
                                </p>
                            </div>

                            {/* Leads Perdidos */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Ban className="w-5 h-5 text-red-500" />
                                    <p className="text-xs font-bold text-gray-400 uppercase">Perdidos</p>
                                </div>
                                <p className="text-3xl font-black text-red-500">
                                    {data?.sales?.filter(s => {
                                        const isCurrentCompany = String(s.companyId) === String(company.id);
                                        const isInRange = filterByDateRange([s], dateRange, 'createdAt').length > 0;
                                        const isLost = s.status?.toLowerCase().includes('perdido') || s.status?.toLowerCase().includes('lost');
                                        const hasMetaTag = s.labels?.some(label =>
                                            label?.toUpperCase().includes('META ADS') || label?.toUpperCase() === 'META ADS'
                                        );
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
                                            const isLost = s.status?.toLowerCase().includes('perdido') || s.status?.toLowerCase().includes('lost');
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
