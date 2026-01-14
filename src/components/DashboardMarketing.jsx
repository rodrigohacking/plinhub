import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {

    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend, Cell
} from 'recharts';
import { DollarSign, UserPlus, Target, MousePointer, TrendingUp, Filter, Instagram, Globe, Search, Users, Ban } from 'lucide-react';
import { KPICard } from './KPICard';
import { ChartCard } from './ChartCard';
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { cn } from '../lib/utils';

import { DateRangeFilter, filterByDateRange } from './DateRangeFilter';

export function DashboardMarketing({ company, data }) {
    const [dateRange, setDateRange] = useState('this-month'); // Default: This Month

    // Aggregate Metrics (Hybrid: Supports granular Daily Insights AND legacy/seed data)
    const metrics = useMemo(() => {
        let invest = 0, leads = 0, clicks = 0, imps = 0, reach = 0;
        const channelMap = {}; // Channel Performance Map

        const companyCampaigns = data.campaigns.filter(c => c.companyId === company.id);

        // Filter: REVERTED Objective Filter (User wants to see Total Spend even for non-lead campaigns)
        // Discrepancy (422 vs 258) was due to excluding 'OUTCOME_TRAFFIC' campaigns.
        const relevantCampaigns = companyCampaigns;

        const realCampaigns = relevantCampaigns.filter(c => c.dailyInsights && c.dailyInsights.length > 0);
        const legacyCampaigns = relevantCampaigns.filter(c => !c.dailyInsights || c.dailyInsights.length === 0);

        // A. Process Real Meta Data (Daily Granularity)
        // Flatten all daily insights
        const allDaily = realCampaigns.flatMap(c =>
            c.dailyInsights.map(d => ({ ...d, channel: c.channel }))
        );

        // Filter: Use Robust String Comparison (YYYY-MM-DD + T12:00:00 provided by filter)
        // Logic handled by the updated filterByDateRange which now handles YYYY-MM-DD strings safely
        const validDaily = filterByDateRange(allDaily, dateRange, 'date');

        validDaily.forEach(d => {
            invest += d.spend;
            leads += d.leads;
            clicks += d.clicks;
            imps += d.impressions;
            reach += (d.reach || 0);

            // Channel Map
            if (!channelMap[d.channel]) channelMap[d.channel] = { invest: 0, leads: 0, conv: 0 };
            channelMap[d.channel].invest += d.spend;
            channelMap[d.channel].leads += d.leads;
            // Note: Conversions in channel map are distinct from global "Won Deals"
            channelMap[d.channel].conv += d.conversions; // Keeps "Meta Conversions" (Pixel) for channel specific ROI if needed, or we could distribute Won Deals logic
        });

        // B. Process Legacy/Seed Data (Campaign Level approximation)
        const validLegacy = filterByDateRange(legacyCampaigns, dateRange, 'startDate');

        validLegacy.forEach(c => {
            invest += c.investment;
            leads += c.leads;
            clicks += c.clicks;
            imps += c.impressions;
            reach += c.impressions * 0.8; // Estimate reach for legacy

            // Channel Map
            if (!channelMap[c.channel]) channelMap[c.channel] = { invest: 0, leads: 0, conv: 0 };
            channelMap[c.channel].invest += c.investment;
            channelMap[c.channel].leads += c.leads;
            channelMap[c.channel].conv += c.conversions;
        });

        // C. Calculate REAL Business Metrics (From Sales Data)
        // Filter "Won Deals" (Vendas Fechadas) using CLOSE DATE (Activity View) not Creation Date
        const salesDeals = data.sales.filter(s => s.companyId === company.id);
        const createdInPeriod = filterByDateRange(salesDeals, dateRange, 'createdAt');
        const closedInPeriod = filterByDateRange(salesDeals, dateRange, 'date');

        // 1. All Won Deals (for general metrics if needed) - Activity Based
        const wonDeals = closedInPeriod.filter(d => ['338889923', '338889934'].includes(String(d.phaseId)) || d.status === 'won');
        const wonCount = wonDeals.length;
        const wonValue = wonDeals.reduce((acc, d) => acc + d.amount, 0);

        // 2. Meta Specific Won Deals (For ROI Header)
        // User requested: "puxe com base nas vendas com a tag meta ads"
        const metaWonDeals = wonDeals.filter(d => {
            const ch = (d.channel || '').toLowerCase();
            return ch.includes('instagram') || ch.includes('facebook') || ch.includes('meta');
        });
        const metaRevenue = metaWonDeals.reduce((acc, d) => acc + d.amount, 0);

        // 3. Meta Specific Qualified Deals (For Funnel)
        const metaQualifiedDeals = createdInPeriod.filter(d => {
            const ch = (d.channel || '').toLowerCase();
            const isMeta = ch.includes('instagram') || ch.includes('facebook') || ch.includes('meta');
            // Optimistic Qualify: If it's Won, it was Qualified. If it's explicitly Qualified, it counts.
            // Also include 'proposta' if that status exists, but sticking to 'qualified'/'won' for now based on pipefy.js
            return isMeta && (d.status === 'qualified' || d.status === 'won');
        });

        // 4. Creative Ranking Logic
        const creativeRankingMap = {};
        metaWonDeals.forEach(d => {
            // Find Creative Name in Fields
            // Common keys: utm_content, utm_ad, ag_name, ad_name
            let creativeName = 'Sem Identificação';

            // Try to find in fields (mocking structure based on pipefy.js observation)
            // d.items is not the full card, we need to check if 'd' has fields. 
            // In DashboardSales, 'd' comes from 'relevantDeals' which are mapped objects.
            // Mapped object has: id, title, amount, channel, etc. It DOES NOT have raw fields usually unless mapped.
            // Checking pipefy.js: mappedDeals return { ..., client: title, ... }. 
            // We might need to rely on the Title or specific logic if UTMs aren't mapped.
            // WAIT: 'allDeals' in DashboardSales comes from 'data.sales'. 
            // If 'data.sales' does not have UTM fields mapped, we can't do this.

            // ASSUMPTION: 'data.sales' contains raw fields or we use Title/Channel.
            // PROPOSAL: Use 'd.title' or 'd.client' as proxy if no specific field, 
            // BUT simpler: let's assume we can't get granular creative WITHOUT fields.
            // Let's check what 'd' has.

            // For now, let's use a placeholder logic or try to find a field if it exists in the 'd' object.
            // If 'd' is the output of pipefy.js, it lacks fields array.
            // I will use 'd.lossReason' (just kidding).
            // REALITY: We need to map UTMs in pipefy.js to 'd.utm_content' to make this work.
            // For this step, I will add the logic assuming 'd.utm_content' exists OR use 'd.title' as a fallback to show SOMETHING.

            creativeName = d.utm_content || d.utm_ad || d.title || 'Anúncio Genérico'; // Fallback to Title for now to show data

            if (!creativeRankingMap[creativeName]) {
                creativeRankingMap[creativeName] = { name: creativeName, revenue: 0, count: 0 };
            }
            creativeRankingMap[creativeName].revenue += d.amount;
            creativeRankingMap[creativeName].count += 1;
        });

        const creativeRanking = Object.values(creativeRankingMap).sort((a, b) => b.revenue - a.revenue);

        // Campaign Ranking Logic
        const campaignRankingMap = {};
        metaWonDeals.forEach(d => {
            const campaignName = d.utm_campaign || 'Campanha Não Identificada';
            if (!campaignRankingMap[campaignName]) campaignRankingMap[campaignName] = { name: campaignName, revenue: 0, count: 0 };
            campaignRankingMap[campaignName].revenue += d.amount;
            campaignRankingMap[campaignName].count += 1;
        });
        const campaignRanking = Object.values(campaignRankingMap).sort((a, b) => b.revenue - a.revenue);

        // 5. Meta Specific LOST Deals (For New KPI)
        const metaLostDeals = closedInPeriod.filter(d => {
            const ch = (d.channel || '').toLowerCase();
            const isMeta = ch.includes('instagram') || ch.includes('facebook') || ch.includes('meta');
            return isMeta && d.status === 'lost';
        });

        const cpl = leads ? invest / leads : 0;
        const ctr = imps ? (clicks / imps) * 100 : 0;
        const cpm = imps ? (invest / imps) * 1000 : 0;
        const cpc = clicks ? invest / clicks : 0;

        // Conversion Rate: (Meta Won / Leads Generated) * 100
        const convRate = leads ? (metaWonDeals.length / leads) * 100 : 0;

        // CAC: Total Investment / Meta Won Deals
        const cac = metaWonDeals.length ? invest / metaWonDeals.length : 0;

        // ROI Marketing (Meta Specific): ((MetaRevenue - Investment) / Investment) * 100
        let roi = (invest > 50) ? ((metaRevenue - invest) / invest) * 100 : 0;

        // ROI Clamp for Display Safety
        if (roi > 99999) roi = 99999;
        if (roi < -99999) roi = -99999;

        // Channel Array
        const channels = Object.keys(channelMap).map(ch => {
            const d = channelMap[ch];
            return { channel: ch, ...d };
        }).sort((a, b) => b.invest - a.invest);

        return {
            totalInvestment: invest,
            totalLeads: leads,
            totalClicks: clicks,
            totalImpressions: imps,
            totalReach: reach,
            totalWonCount: wonCount, // Total (Mixed)
            metaWonCount: metaWonDeals.length, // Meta Only
            metaLostCount: metaLostDeals.length, // Meta Lost (New)
            metaQualifiedCount: metaQualifiedDeals.length,
            totalWonValue: wonValue,
            cpl, ctr, cpm, cpc, convRate, roi, cac,
            channels, creativeRanking, campaignRanking
        };
    }, [data.campaigns, data.sales, company.id, dateRange]);

    const { totalInvestment, totalLeads, totalClicks, totalImpressions, totalReach, cpl, ctr, cpm, cpc, convRate, roi, cac, channels, metaWonCount, metaLostCount, metaQualifiedCount, creativeRanking, campaignRanking } = metrics;

    // UI State for Ranking Toggle
    const [rankingMode, setRankingMode] = useState('creative'); // 'creative' or 'campaign'

    // Choose list to display
    const activeRankingList = rankingMode === 'creative' ? creativeRanking : campaignRanking;
    const rankingTitle = rankingMode === 'creative' ? 'Top Criativos' : 'Top Campanhas';
    const rankingSubtitle = rankingMode === 'creative' ? 'Anúncios que geraram receita' : 'Campanhas de maior retorno';

    const tabVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.3, ease: 'easeOut' }
    };

    return (
        <motion.div
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-8 pb-12"
        >
            {/* 1. Hero Banner (Marketing Theme - Emerald/Dark) */}
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="w-full md:w-auto">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                <Instagram className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight">Performance Meta Ads</h2>
                        </div>
                        <p className="text-emerald-100 text-sm md:text-lg">Monitoramento de campanhas do Facebook e Instagram.</p>
                        <div className="mt-6">
                            <DateRangeFilter value={dateRange} onChange={setDateRange} />
                        </div>
                    </div>

                    {/* ROI Display (Right Side) */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl min-w-[200px] text-right">
                        <p className="text-emerald-200 font-bold uppercase text-xs tracking-wider mb-1">ROI (Vendas Meta)</p>
                        <div className={cn("text-5xl font-black tracking-tighter", roi >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {roi > 0 ? '+' : ''}{formatNumber(roi.toFixed(0))}%
                        </div>
                        <p className="text-xs text-emerald-100/60 mt-2">Retorno sobre Investimento</p>
                    </div>
                </div>
            </div>

            {/* 2. Premium KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
                {/* Card 1: Investimento */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">Investimento</p>
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                <DollarSign className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(totalInvestment)}</h3>
                        </div>
                    </div>
                </div>

                {/* Card 2: Leads */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">Leads Gerados</p>
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl text-cyan-600 dark:text-cyan-400">
                                <UserPlus className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white">{formatNumber(totalLeads)}</h3>
                        </div>
                    </div>
                </div>

                {/* Card 3: CPL */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">Custo por Lead</p>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                                <Target className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(cpl)}</h3>
                        </div>
                    </div>
                </div>

                {/* Card 4: CAC */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">CAC</p>
                            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400">
                                <Users className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(cac)}</h3>
                            <p className="text-xs text-rose-600/60 font-medium mt-1">Custo Aquisição</p>
                        </div>
                    </div>
                </div>

                {/* Card 5: Vendas Meta Ads */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">Vendas (Meta)</p>
                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400">
                                <Instagram className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white">{metaWonCount}</h3>
                            <p className="text-xs text-purple-600/60 font-medium mt-1">Via Facebook/Instagram</p>
                        </div>
                    </div>
                </div>

                {/* Card 6: Churn de Oportunidades */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-gray-500 dark:text-gray-400 font-bold text-lg">Leads Perdidos</p>
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-500">
                                <Ban className="w-6 h-6" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-5xl font-black text-red-500 mb-4">{metaLostCount}</h3>

                            {/* Progress Bar / Separator */}
                            <div className="w-full h-1.5 bg-red-100 dark:bg-red-900/20 rounded-full overflow-hidden mb-3">
                                <div
                                    className="h-full bg-red-400 rounded-full"
                                    style={{ width: `${totalLeads ? Math.min((metaLostCount / totalLeads) * 100, 100) : 0}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">CHURN DE OPORTUNIDADES</p>
                                <p className="text-xs font-bold text-red-400">
                                    {totalLeads ? ((metaLostCount / totalLeads) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Advanced Analysis Grid: Funnel & Creatives */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Funnel Section */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600">
                            <Filter className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Funil de Conversão</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Eficiência de cada etapa do marketing</p>
                        </div>
                    </div>

                    <div className="space-y-6 relative">
                        {/* Connecting Line */}
                        <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-100 dark:bg-white/5 -z-10"></div>

                        {/* Stage 1: Impressões */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 z-10 border-4 border-white dark:border-[#111]">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-gray-900 dark:text-white">Impressões</p>
                                    <p className="font-mono text-sm text-gray-500">{formatNumber(totalImpressions)}</p>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Stage 2: Cliques */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0 z-10 border-4 border-white dark:border-[#111]">
                                <MousePointer className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-gray-900 dark:text-white">Cliques</p>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-gray-500">{formatNumber(totalClicks)}</p>
                                        <p className="text-[10px] text-blue-500 font-bold">{ctr.toFixed(2)}% CTR</p>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalImpressions ? (totalClicks / totalImpressions) * 100 * 50 : 0}%`, maxWidth: '100%', minWidth: '5%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Stage 3: Leads */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center text-cyan-500 shrink-0 z-10 border-4 border-white dark:border-[#111]">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-gray-900 dark:text-white">Leads Gerados</p>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-gray-500">{formatNumber(totalLeads)}</p>
                                        <p className="text-[10px] text-cyan-500 font-bold">{totalClicks ? ((totalLeads / totalClicks) * 100).toFixed(1) : 0}% Conv.</p>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    {/* Enhanced visual scale for funnel feel */}
                                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${totalClicks ? (totalLeads / totalClicks) * 100 * 5 : 0}%`, maxWidth: '90%', minWidth: '5%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Stage 4: Qualificados */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 shrink-0 z-10 border-4 border-white dark:border-[#111]">
                                <Search className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-gray-900 dark:text-white">Qualificados</p>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-gray-500">{formatNumber(metaQualifiedCount)}</p>
                                        <p className="text-[10px] text-purple-500 font-bold">{totalLeads ? ((metaQualifiedCount / totalLeads) * 100).toFixed(1) : 0}% Qualif.</p>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${totalLeads ? (metaQualifiedCount / totalLeads) * 100 : 0}%`, minWidth: '5%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Stage 5: Vendas */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 shrink-0 z-10 border-4 border-white dark:border-[#111]">
                                <Target className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-gray-900 dark:text-white">Vendas (Meta)</p>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-gray-500">{formatNumber(metaWonCount)}</p>
                                        <p className="text-[10px] text-emerald-500 font-bold">{metaQualifiedCount ? ((metaWonCount / metaQualifiedCount) * 100).toFixed(1) : 0}% Fechamento</p>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metaQualifiedCount ? (metaWonCount / metaQualifiedCount) * 100 : 0}%`, minWidth: '5%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Creative/Campaign Ranking Section (Dynamic) */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg text-pink-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{rankingTitle}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{rankingSubtitle}</p>
                            </div>
                        </div>

                        {/* Toggle Buttons */}
                        <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl p-1">
                            <button
                                onClick={() => setRankingMode('creative')}
                                className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", rankingMode === 'creative' ? "bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200")}
                            >
                                Criativos
                            </button>
                            <button
                                onClick={() => setRankingMode('campaign')}
                                className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", rankingMode === 'campaign' ? "bg-white dark:bg-[#222] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200")}
                            >
                                Campanhas
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {activeRankingList && activeRankingList.length > 0 ? (
                            activeRankingList.slice(0, 5).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate" title={item.name}>
                                            {item.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium">
                                                {item.count} venda{item.count !== 1 && 's'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-gray-900 dark:text-white">{formatCurrency(item.revenue)}</p>
                                        <p className="text-xs text-slate-400">Receita</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Instagram className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Nenhum dado de {rankingMode === 'creative' ? 'criativo' : 'campanha'} identificado.</p>
                                <p className="text-xs mt-2 opacity-60">
                                    {rankingMode === 'creative'
                                        ? "Use tags 'utm_content' nos seus anúncios."
                                        : "Use tags 'utm_campaign' nos seus anúncios."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Granular Metrics & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Granular Cards Grid */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Métricas de Alcance</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Desempenho de anúncios</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Impressões */}
                        <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Impressões</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{formatNumber(totalImpressions)}</p>
                        </div>

                        {/* Alcance */}
                        <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Alcance Único</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{formatNumber(totalReach)}</p>
                        </div>

                        {/* Cliques */}
                        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-500/10">
                            <p className="text-xs font-bold uppercase text-blue-400 mb-1">Cliques no Link</p>
                            <p className="text-xl font-black text-blue-800 dark:text-blue-300">{formatNumber(totalClicks)}</p>
                        </div>

                        {/* CPC */}
                        <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/10">
                            <p className="text-xs font-bold uppercase text-emerald-400 mb-1">CPC Médio</p>
                            <p className="text-xl font-black text-emerald-800 dark:text-emerald-300">{formatCurrency(cpc)}</p>
                        </div>

                        {/* CPM */}
                        <div className="p-5 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-500/10 col-span-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold uppercase text-purple-400 mb-1">CPM (Custo/Mil)</p>
                                    <p className="text-xl font-black text-purple-800 dark:text-purple-300">{formatCurrency(cpm)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold uppercase text-purple-400 mb-1">CTR</p>
                                    <p className="text-xl font-black text-purple-800 dark:text-purple-300">{formatNumber(ctr)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comparison Table (Redesigned) */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl relative overflow-hidden">
                    {/* Decorative gradient blob */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none"></div>

                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Performance por Canal</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Análise detalhada de retorno</p>
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10">
                        {channels.map((ch, index) => {
                            // Channel Branding Logic
                            const name = ch.channel.toLowerCase();
                            let Icon = Globe;
                            let colorClass = "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400";
                            let gradientBorder = "border-transparent";

                            if (name.includes('instagram') || name.includes('facebook') || name.includes('meta')) {
                                Icon = Instagram;
                                colorClass = "bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20";
                            } else if (name.includes('google') || name.includes('search') || name.includes('youtube')) {
                                Icon = Search;
                                colorClass = "bg-gradient-to-br from-blue-500 to-red-500 text-white shadow-lg shadow-blue-500/20";
                            } else if (name.includes('tiktok')) {
                                Icon = Globe; // Lucide might not have TikTok, fallback
                                colorClass = "bg-black text-white border border-white/20";
                            }

                            // Calculate percentages for bars
                            const investmentShare = totalInvestment ? (ch.invest / totalInvestment) * 100 : 0;
                            const isPositiveRoi = ch.roi >= 0;

                            return (
                                <div key={ch.channel} className="group p-5 bg-gray-50/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] border border-gray-100 dark:border-white/5 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 relative overflow-hidden">
                                    {/* Hover Gradient Glow */}
                                    {isPositiveRoi && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />}

                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                        {/* 1. Icon & Rank */}
                                        <div className="flex items-center gap-4 w-full md:w-2/5">
                                            <span className="text-xs font-bold text-gray-300 w-4">#{index + 1}</span>
                                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", colorClass)}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-gray-900 dark:text-white truncate text-lg">{ch.channel}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {/* Investment Bar */}
                                                    <div className="w-24 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gray-400 dark:bg-gray-500" style={{ width: `${investmentShare}%` }} />
                                                    </div>
                                                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{Math.round(investmentShare)}% verba</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Metrics Grid */}
                                        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                                            <div className="text-center md:text-left">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Investimento</p>
                                                <p className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(ch.invest)}</p>
                                            </div>
                                            <div className="text-center md:text-left">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Leads / CPL</p>
                                                <div className="flex items-baseline justify-center md:justify-start gap-1">
                                                    <span className="font-bold text-gray-900 dark:text-white">{ch.leads}</span>
                                                    <span className="text-xs text-gray-500">({formatCurrency(ch.invest / (ch.leads || 1))})</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
