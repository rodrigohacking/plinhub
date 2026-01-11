import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {

    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend, Cell
} from 'recharts';
import { DollarSign, UserPlus, Target, MousePointer, TrendingUp, Filter, Instagram, Globe, Search } from 'lucide-react';
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
        // Filter "Won Deals" (Vendas Fechadas) for the same period
        // Logic: Created Date vs Won Date? KPI usually "Sales from Leads Generated in Period" (Cohort) OR "Sales Closed in Period" (Activity).
        // User said: "base nas Vendas Fechadas do dashboard de vendas" which uses Creation Date (Cohort) based on our previous fix.
        // Let's stick to Cohort (Created Date) to align with "Leads Gerados" -> "Vendas Fechadas" funnel.
        const salesDeals = data.sales.filter(s => s.companyId === company.id);
        const createdInPeriod = filterByDateRange(salesDeals, dateRange, 'createdAt');
        // Filter for "Won" status/phases
        const wonDeals = createdInPeriod.filter(d => ['338889923', '338889934'].includes(String(d.phaseId)) || d.status === 'won');
        const wonCount = wonDeals.length;
        const wonValue = wonDeals.reduce((acc, d) => acc + d.amount, 0);


        // Calculate Derived
        const cpl = leads ? invest / leads : 0;
        const ctr = imps ? (clicks / imps) * 100 : 0;
        const cpm = imps ? (invest / imps) * 1000 : 0;
        const cpc = clicks ? invest / clicks : 0;

        // Conversion Rate: (Won Deals / Leads Generated) * 100
        const convRate = leads ? (wonCount / leads) * 100 : 0;

        // ROI Marketing: ((Revenue - Investment) / Investment) * 100
        // Valid only if investment is significant (> 50) to avoid infinite/noisy numbers
        let roi = (invest > 50) ? ((wonValue - invest) / invest) * 100 : 0;

        // ROI Clamp for Display Safety (kept generic)
        if (roi > 99999) roi = 99999;
        if (roi < -99999) roi = -99999;

        // Channel Array
        const channels = Object.keys(channelMap).map(ch => {
            const d = channelMap[ch];
            // Est. Channel ROI using Pixel Conversions (fallback) or ratio?
            // For now keeping original internal logic for channel table until user asks for attribution model
            let internalRoi = (d.invest > 50) ? ((d.conv * 500 - d.invest) / d.invest) * 100 : 0;
            if (internalRoi > 99999) internalRoi = 99999;
            return { channel: ch, ...d, roi: internalRoi };
        }).sort((a, b) => b.roi - a.roi);

        return {
            totalInvestment: invest,
            totalLeads: leads,
            totalClicks: clicks,
            totalImpressions: imps,
            totalReach: reach,
            totalWonCount: wonCount,
            totalWonValue: wonValue,
            cpl, ctr, cpm, cpc, convRate, roi,
            channels
        };
    }, [data.campaigns, data.sales, company.id, dateRange]);

    const { totalInvestment, totalLeads, totalClicks, totalImpressions, totalReach, cpl, ctr, cpm, cpc, convRate, roi, channels } = metrics;

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
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h2 className="text-4xl font-black mb-2 tracking-tight">Performance de Marketing</h2>
                        <p className="text-emerald-100 text-lg">Monitoramento de ROI e aquisição de leads.</p>
                    </div>
                    {/* Badge Removed per user request */}
                </div>
                <div className="mt-8">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                </div>
            </div>

            {/* 2. Premium KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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

                {/* Card 4: Conversão (REAL) */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">Conversão em Vendas</p>
                            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400">
                                <MousePointer className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400">{formatPercent(convRate)}</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Leads → Vendas</p>
                        </div>
                    </div>
                </div>

                {/* Card 5: ROI */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">ROI Marketing</p>
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className={cn("text-3xl font-black", roi >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {formatNumber(roi.toFixed(0))}%
                            </h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Retorno sobre Invest.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Granular Metrics & Insights */}
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
                                        <div className="flex-1 grid grid-cols-3 gap-4 w-full">
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
                                            <div className="flex flex-col items-center md:items-end justify-center">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">ROI</p>
                                                <div className={cn(
                                                    "px-3 py-1 rounded-lg text-sm font-bold border",
                                                    isPositiveRoi
                                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                        : "bg-red-500/10 text-red-500 border-red-500/20"
                                                )}>
                                                    {isPositiveRoi ? '+' : ''}{formatNumber(ch.roi)}%
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
