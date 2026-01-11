import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { Target, Ban, CircleDollarSign, AlertCircle, BarChart as BarChartIcon, Clock, Users, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import { KPICard } from './KPICard';
import { ChartCard } from './ChartCard';
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { DateRangeFilter, filterByDateRange } from './DateRangeFilter';

export function DashboardSales({ company, data }) {
    const [dateRange, setDateRange] = useState('this-month');
    const [activeTab, setActiveTab] = useState('geral'); // geral, sdr, metas
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortOption, setSortOption] = useState('date-desc'); // date-desc, date-asc, value-desc, value-asc
    const [filterChannel, setFilterChannel] = useState('all');

    // Filter sales/deals for this company and date range
    // Split filtering logic:
    // 1. createdDeals: Filter by 'createdAt' -> For "Leads Created" metric (Top of Funnel)
    // 2. relevantDeals: Filter by 'date' (wonDate/createdAt) -> For "Sales", "Revenue", "List" (Bottom of Funnel)
    const { createdDeals, relevantDeals } = useMemo(() => {
        const allDeals = data.sales.filter(s => s.companyId === company.id);
        return {
            createdDeals: filterByDateRange(allDeals, dateRange, 'createdAt'),
            relevantDeals: filterByDateRange(allDeals, dateRange, 'date') // Changed to 'date' (effective date) to capture Won/Lost events in period
        };
    }, [data.sales, company.id, dateRange]);

    // Use relevantDeals for most charts/tables
    const filteredDeals = relevantDeals;

    // Calculations for CRM Pipeline
    const metrics = useMemo(() => {
        // 1. Leads Entraram (Target: 114)
        // Definition: STRICTLY cards created in the period (filtered by dateRange)
        const leadsCreatedCount = createdDeals.length;

        // 2. Leads Perdidos (Target: 37)
        // Definition: All deals lost in the period
        const lostDeals = relevantDeals.filter(d => d.status === 'lost');
        const lostCount = lostDeals.length;

        // 3. Leads Qualificados (Target: 77)
        // Definition: User Formula: (Entraram - Perdidos)
        const qualifiedCount = leadsCreatedCount - lostCount;

        // 4. Vendas Fechadas
        // Definition: Phase "Fechamento - Ganho" (ID 338889923) or "Apólice Fechada" (ID 338889934)
        // CHANGED: Use `createdDeals` (Cohort View) to match user expectation of "Sales from this Month's Leads"
        const wonDeals = createdDeals.filter(d => ['338889923', '338889934'].includes(String(d.phaseId)) || d.status === 'won');
        const wonCount = wonDeals.length;

        // Goals Logic
        const currentMonth = new Date().toISOString().slice(0, 7);

        // Robust finding with type safety
        const goalData = data.goals?.find(g => String(g.companyId) === String(company.id) && g.month === currentMonth);

        console.log("DashboardSales: Goals Lookup", {
            hasGoals: !!data.goals,
            count: data.goals?.length,
            currentMonth,
            companyId: company.id,
            found: goalData
        });

        const goals = {
            revenue: goalData?.revenue || 60000,
            deals: goalData?.deals || 16,
            leads: goalData?.leads || 150,
            sdrGoals: goalData?.sdrGoals || {} // Added SDR Goals
        };

        // Other Metrics
        const newDeals = relevantDeals.filter(d => d.status === 'new');
        const totalWonValue = wonDeals.reduce((acc, d) => acc + d.amount, 0);
        const avgTicket = wonCount ? totalWonValue / wonCount : 0;
        const totalDeals = relevantDeals.length;
        // Conversion: Won / Created (Global)
        const conversionRate = leadsCreatedCount ? (wonCount / leadsCreatedCount) * 100 : 0;

        const closingTimeSum = wonDeals.reduce((acc, d) => acc + (d.daysToClose || 0), 0);
        const avgClosingTime = wonCount ? closingTimeSum / wonCount : 0;

        return {
            newCount: newDeals.length,
            qualifiedCount, // Calculated formula
            wonCount,
            lostCount,
            wonValue: totalWonValue,
            avgTicket: avgTicket,
            totalDeals,
            conversionRate,
            avgClosingTime,
            leadsCreatedCount, // "Leads Entraram"
            wonDeals, // Exposing Array for Table
            goals // Dynamic Goals
        };
    }, [createdDeals, relevantDeals, data.goals, company.id]);

    // SDR Agreggations
    const sdrStats = useMemo(() => {
        const map = {};
        createdDeals.forEach(d => {
            if (!map[d.seller]) map[d.seller] = {
                name: d.seller,
                total: 0,
                won: 0,
                wonValue: 0,
                daysSum: 0,
                lostReasons: {}
            };
            map[d.seller].total++;
            if (d.status === 'won') {
                map[d.seller].won++;
                map[d.seller].wonValue += d.amount;
                map[d.seller].daysSum += (d.daysToClose || 0);
            }
            if (d.status === 'lost') {
                const reason = d.lossReason || 'Outros';
                map[d.seller].lostReasons[reason] = (map[d.seller].lostReasons[reason] || 0) + 1;
            }
        });

        return Object.values(map).map(s => ({
            ...s,
            conversion: s.total ? (s.won / s.total) * 100 : 0,
            avgTime: s.won ? s.daysSum / s.won : 0
        })).sort((a, b) => b.wonValue - a.wonValue);

    }, [createdDeals]);

    // Common Colors
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const PIE_COLORS = ['#3b82f6', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7'];

    // Animation Variants
    const tabVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.3, ease: 'easeOut' }
    };

    // Render Content based on Tab
    // Render Content based on Tab
    const renderGeral = () => (
        <motion.div
            key="geral"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-8"
        >
            {/* 1. Hero Banner (Premium - Geral) */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h2 className="text-4xl font-black mb-2 tracking-tight text-white">Visão Geral</h2>
                        <p className="text-blue-100 text-lg">Resumo estratégico e métricas principais.</p>
                    </div>
                    {/* Badge Removed */}
                </div>
            </div>

            {/* 2. Premium KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Entraram */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Leads Entraram</p>
                            <h3 className="text-4xl font-black text-gray-900 dark:text-white">{metrics.leadsCreatedCount}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                            <Target className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-full"></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">Topo do Funil</p>
                </div>

                {/* Card 2: Qualificados */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Qualificados</p>
                            <h3 className="text-4xl font-black text-blue-600 dark:text-blue-400">{metrics.qualifiedCount}</h3>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${(metrics.qualifiedCount / (metrics.leadsCreatedCount || 1)) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">
                        {((metrics.qualifiedCount / (metrics.leadsCreatedCount || 1)) * 100).toFixed(0)}% Conversão
                    </p>
                </div>

                {/* Card 3: Vendas */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Vendas Fechadas</p>
                            <h3 className="text-4xl font-black text-green-600 dark:text-green-400">{metrics.wonCount}</h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-2xl text-green-600">
                            <CircleDollarSign className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(metrics.wonCount / (metrics.qualifiedCount || 1)) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">
                        {((metrics.wonCount / (metrics.qualifiedCount || 1)) * 100).toFixed(0)}% Fechamento
                    </p>
                </div>
                {/* Card 4: Perdidos */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Leads Perdidos</p>
                            <h3 className="text-4xl font-black text-red-500 dark:text-red-400">{metrics.lostCount}</h3>
                        </div>
                        <div className="p-3 bg-red-50 rounded-2xl text-red-500">
                            <Ban className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 w-full opacity-50"></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">Churn de Oportunidades</p>
                </div>
            </div>



            {/* 3. Financial Cards (Row 2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Faturamento */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
                            <CircleDollarSign className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wide">Faturamento Total</p>
                            <h3 className="text-4xl font-black text-gray-900 dark:text-white mt-1">{formatCurrency(metrics.wonValue)}</h3>
                        </div>
                    </div>
                </div>

                {/* Ticket Médio */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400">
                            <BarChartIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wide">Ticket Médio</p>
                            <h3 className="text-4xl font-black text-gray-900 dark:text-white mt-1">{formatCurrency(metrics.avgTicket)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 3: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm h-[350px]">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">Perdidos ❌</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        {filteredDeals.filter(d => d.status === 'lost').length > 0 ? (
                            <BarChart data={(() => {
                                const counts = {};
                                filteredDeals.filter(d => d.status === 'lost').forEach(d => {
                                    const reason = d.lossReason || 'Outros';
                                    counts[reason] = (counts[reason] || 0) + 1;
                                });
                                return Object.keys(counts).map(k => ({ name: k, value: counts[k] })).sort((a, b) => b.value - a.value);
                            })()} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24}>
                                    {/* Optional: Add labels on bars for clarity */}
                                </Bar>
                            </BarChart>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                                Nenhuma perda registrada neste período.
                            </div>
                        )}
                    </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm h-[350px]">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">Origens 📊</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie
                                data={(() => {
                                    const counts = {};
                                    createdDeals.forEach(d => {
                                        counts[d.channel] = (counts[d.channel] || 0) + 1;
                                    });

                                    // Group small values into "Outros"
                                    let data = Object.keys(counts).map(k => ({ name: k, value: counts[k] })).sort((a, b) => b.value - a.value);

                                    if (data.length > 5) {
                                        const top5 = data.slice(0, 5);
                                        const others = data.slice(5).reduce((acc, curr) => acc + curr.value, 0);
                                        if (others > 0) {
                                            top5.push({ name: 'Outros', value: others });
                                        }
                                        return top5;
                                    }
                                    return data;
                                })()}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {[...Array(6)].map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Section 4: Últimas Vendas ("Recent Sales" Table) */}
            <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        Últimas Vendas 📋
                    </h3>

                    {/* Filter and Sort Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* Channel Filter */}
                        <select
                            value={filterChannel}
                            onChange={(e) => {
                                setFilterChannel(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
                        >
                            <option value="all">Todos os Canais</option>
                            {/* Dynamic Channels */}
                            {Array.from(new Set(metrics.wonDeals?.map(d => d.channel || 'Desconhecido') || [])).map(ch => (
                                <option key={ch} value={ch}>{ch}</option>
                            ))}
                        </select>

                        {/* Sort Control */}
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
                        >
                            <option value="date-desc">Mais Recentes</option>
                            <option value="date-asc">Mais Antigas</option>
                            <option value="value-desc">Maior Valor</option>
                            <option value="value-asc">Menor Valor</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Cliente / Título</th>
                                <th className="px-6 py-4">Vendedor</th>
                                <th className="px-6 py-4">Canal</th>
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {(() => {
                                // 1. Source: Use 'wonDeals' (Cohort View) calculated in metrics
                                // This ensures the table matches the "10" count exactly.
                                let tableData = [...(metrics.wonDeals || [])];

                                // 2. Filter Logic
                                if (filterChannel !== 'all') {
                                    tableData = tableData.filter(d => (d.channel || 'Desconhecido') === filterChannel);
                                }

                                // 3. Sort Logic
                                tableData.sort((a, b) => {
                                    const dateA = new Date(a.date || a.createdAt);
                                    const dateB = new Date(b.date || b.createdAt);
                                    const valA = a.amount || 0;
                                    const valB = b.amount || 0;

                                    switch (sortOption) {
                                        case 'date-desc': return dateB - dateA;
                                        case 'date-asc': return dateA - dateB;
                                        case 'value-desc': return valB - valA;
                                        case 'value-asc': return valA - valB;
                                        default: return 0;
                                    }
                                });

                                // 4. Pagination Logic
                                const totalPages = Math.ceil(tableData.length / itemsPerPage);
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                const currentData = tableData.slice(startIndex, startIndex + itemsPerPage);

                                if (currentData.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                                                Nenhuma venda encontrada com estes filtros.
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <>
                                        {currentData.map((deal) => (
                                            <tr key={deal.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                    {new Date(deal.date || deal.createdAt).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                    {deal.client || deal.title}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                    {deal.seller}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                                        {deal.channel || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(deal.amount)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-bold uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                        Vendido
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {(() => {
                    // Clone Logic for Pagination Count (Repeated logic, could be extracted but keeping inline for safety)
                    let tableData = [...(metrics.wonDeals || [])];
                    if (filterChannel !== 'all') {
                        tableData = tableData.filter(d => (d.channel || 'Desconhecido') === filterChannel);
                    }

                    const totalItems = tableData.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage);
                    // Reset page if out of bounds (Handled in filter change, but safety here)
                    // Note: Cannot call setState in render. Rely on useEffect if needed, or simple display logic.

                    if (totalItems > 0) {
                        return (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <span>Linhas por página:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-white dark:bg-[#111] border border-gray-300 dark:border-white/10 rounded-md text-sm p-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <span>
                                        Página {currentPage} de {totalPages || 1}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

            </div>
        </motion.div>
    );

    const renderSDR = () => (
        <motion.div
            key="sdr"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-8"
        >
            {/* 1. Hero Banner (SDR Theme - Violet/Dark) */}
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h2 className="text-4xl font-black mb-2 tracking-tight text-white">Performance do Time</h2>
                        <p className="text-violet-100 text-lg">Análise detalhada de produtividade e conversão.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                            <p className="text-xs uppercase font-bold text-violet-200 mb-1">SDRs Ativos</p>
                            <p className="text-2xl font-black text-white">{sdrStats.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 1.5 Competitive Ranking */}
            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    🏆 Ranking de Vendedores
                </h3>
                <div className="space-y-4">
                    {sdrStats.sort((a, b) => b.wonValue - a.wonValue).map((sdr, index) => {
                        const count = sdrStats.length || 1;
                        const revenueGoal = metrics.goals.revenue || 60000;
                        const individualGoal = metrics.goals.sdrGoals?.[sdr.name]?.revenue || (revenueGoal / count);
                        const percent = Math.min((sdr.wonValue / (individualGoal || 1)) * 100, 100);

                        let rankColor = "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400";
                        let rankBorder = "border-transparent";
                        let cardStyle = "border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5";
                        let barColor = "bg-[#FD295E]";

                        if (index === 0) {
                            rankColor = "bg-yellow-100 text-yellow-700 border-yellow-200 shadow-yellow-100";
                            cardStyle = "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10";
                            barColor = "bg-yellow-500";
                        }
                        if (index === 1) {
                            rankColor = "bg-slate-200 text-slate-700 border-slate-300";
                            cardStyle = "border-slate-200 bg-slate-50/50 dark:bg-slate-900/10";
                            barColor = "bg-slate-500";
                        }
                        if (index === 2) {
                            rankColor = "bg-orange-100 text-orange-800 border-orange-200";
                            cardStyle = "border-orange-200 bg-orange-50/50 dark:bg-orange-900/10";
                            barColor = "bg-orange-500";
                        }

                        return (
                            <div key={index} className={`flex items-center gap-4 p-4 rounded-2xl border ${cardStyle} transition-all`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 ${rankColor}`}>
                                    {index + 1}º
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-bold text-gray-900 dark:text-white text-lg">{sdr.name}</p>
                                        <div className="text-right">
                                            <p className="font-black text-gray-900 dark:text-white">{formatCurrency(sdr.wonValue)}</p>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Meta: {formatCurrency(individualGoal)}</p>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-100 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${barColor} shadow-lg`}
                                            style={{ width: `${percent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 2. KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Leads Atendidos */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Leads Atendidos</p>
                            <h3 className="text-4xl font-black text-gray-900 dark:text-white">{metrics.leadsCreatedCount}</h3>
                        </div>
                        <div className="p-3 bg-[#FD295E]/10 rounded-2xl text-[#FD295E]">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FD295E] w-full"></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">Volume Total</p>
                </div>

                {/* Card 2: Vendas Fechadas */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Vendas Fechadas</p>
                            <h3 className="text-4xl font-black text-green-600 dark:text-green-400">{metrics.wonCount}</h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-2xl text-green-600">
                            <CircleDollarSign className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-full"></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">Sucesso Absoluto</p>
                </div>

                {/* Card 3: Tempo Médio */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Tempo Médio</p>
                            <h3 className="text-4xl font-black text-orange-500 dark:text-orange-400">{metrics.avgClosingTime.toFixed(1)} <span className="text-lg text-gray-400 font-medium">dias</span></h3>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-2xl text-orange-500">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 w-1/2"></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">Ciclo de Venda</p>
                </div>

                {/* Card 4: Taxa Conversão */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Conversão Global</p>
                            <h3 className="text-4xl font-black text-purple-600 dark:text-purple-400">{formatPercent(metrics.conversionRate)}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                            <Percent className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${Math.min(metrics.conversionRate, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-bold uppercase">Eficiência do Time</p>
                </div>
            </div>

            {/* 3. Section: Performance Individual */}
            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-2">
                    Performance Individual dos SDR's 📊
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[350px]">
                    {/* Conversion by SDR */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <h3 className="text-xs font-bold uppercase text-gray-400 mb-6">Taxa de Conversão</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={sdrStats.sort((a, b) => b.conversion - a.conversion)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#64748b' }} interval={0} />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value) => [`${value.toFixed(1)}%`, 'Conversão']}
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="conversion" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Avg Time by SDR */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <h3 className="text-xs font-bold uppercase text-gray-400 mb-6">Tempo Médio (Dias)</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={sdrStats.sort((a, b) => a.avgTime - b.avgTime)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    formatter={(value) => [`${value.toFixed(1)} dias`, 'Tempo Médio']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="avgTime" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Sales Value by SDR */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <h3 className="text-xs font-bold uppercase text-gray-400 mb-6">Valor de Vendas</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={sdrStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#64748b' }} interval={0} />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value), 'Vendas']}
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="wonValue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 4. Section: Funnel Gauges */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 px-2">
                    Conversão entre Etapas 🔄
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Lead Novo → Qualificado', val: 100 * (metrics.qualifiedCount / (metrics.leadsCreatedCount || 1)), color: '#3b82f6' },
                        { label: 'Qualificado → Proposta', val: 75, color: '#8b5cf6' }, // Mock
                        { label: 'Proposta → Contrato', val: 40, color: '#10b981' },
                    ].map((gauge, idx) => (
                        <div key={idx} className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                            <h3 className="text-xs font-bold uppercase text-gray-400 mb-4 tracking-wide">{gauge.label}</h3>
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                {/* Gauge Background */}
                                <div className="absolute inset-0 rounded-full border-[12px] border-slate-100 dark:border-slate-800"></div>
                                {/* Gauge Value (Static simplified visual for now) */}
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="52" // 64 - 12
                                        fill="transparent"
                                        stroke={gauge.color}
                                        strokeWidth="12"
                                        strokeDasharray={`${(Math.min(gauge.val, 100) / 100) * (2 * Math.PI * 52)} 1000`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className="text-3xl font-black text-gray-800 dark:text-white z-10">{gauge.val.toFixed(0)}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. Section: Motivos de Perda */}
            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 h-[450px] flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    Motivos de Perda (Detalhado) ❌
                </h2>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sdrStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                            <YAxis tick={{ fill: '#64748b' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f1f5f9' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="lostReasons.Preço alto" name="Preço Alto" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="lostReasons.Concorrente" name="Concorrente" stackId="a" fill="#f87171" />
                            <Bar dataKey="lostReasons.Sem contato" name="Sem contato" stackId="a" fill="#fca5a5" />
                            <Bar dataKey="lostReasons.Desistência" name="Desistência" stackId="a" fill="#fee2e2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </motion.div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Header with Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendas</h1>
                    <div className="flex gap-6 text-sm mt-4">
                        <button
                            onClick={() => setActiveTab('geral')}
                            className={`font-semibold pb-4 px-1 border-b-2 transition-colors ${activeTab === 'geral' ? 'text-[#FD295E] border-[#FD295E]' : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200'}`}
                        >
                            Geral
                        </button>
                        <button
                            onClick={() => setActiveTab('sdr')}
                            className={`font-semibold pb-4 px-1 border-b-2 transition-colors ${activeTab === 'sdr' ? 'text-[#FD295E] border-[#FD295E]' : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200'}`}
                        >
                            SDR
                        </button>
                        <button
                            onClick={() => setActiveTab('metas')}
                            className={`font-semibold pb-4 px-1 border-b-2 transition-colors ${activeTab === 'metas' ? 'text-[#FD295E] border-[#FD295E]' : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200'}`}
                        >
                            Metas
                        </button>
                    </div>
                </div>
                <div className="mb-4 md:mb-0">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'geral' && renderGeral()}
                {activeTab === 'sdr' && renderSDR()}
                {activeTab === 'metas' && (
                    <motion.div
                        key="metas"
                        variants={tabVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="space-y-8"
                    >
                        {(() => {
                            const today = new Date();
                            const currentMonthName = today.toLocaleString('pt-BR', { month: 'long' });
                            const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

                            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                            const diffTime = Math.abs(endOfMonth - today);
                            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            return (
                                <div className="bg-gradient-to-r from-[#FD295E] to-indigo-700 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                                        <div>
                                            <h2 className="text-4xl font-black mb-2 tracking-tight text-white">Metas de {capitalizedMonth}</h2>
                                            <p className="text-white/80 text-lg">Acompanhamento em tempo real da performance do time.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                                                <p className="text-xs uppercase font-bold text-white/70 mb-1">Dias Restantes</p>
                                                <p className="text-2xl font-black text-white">{daysRemaining} Dias</p>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                                                <p className="text-xs uppercase font-bold text-white/70 mb-1">Status Geral</p>
                                                <p className="text-2xl font-black text-emerald-300">Na Meta 🚀</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Main Goals Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Revenue Goal */}
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Meta de Faturamento</h3>
                                        <p className="text-gray-500 dark:text-gray-400">Mês Atual</p>
                                    </div>
                                    <div className="p-3 bg-[#FD295E]/10 rounded-xl text-[#FD295E]">
                                        <Target className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="w-40 h-40 relative flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadialBarChart
                                                innerRadius="80%"
                                                outerRadius="100%"
                                                startAngle={180}
                                                endAngle={0}
                                                data={[{ name: 'Meta', value: 100, fill: '#f1f5f9' }, { name: 'Realizado', value: Math.min(((metrics.wonValue / metrics.goals.revenue) * 100), 100), fill: '#FD295E' }]}
                                            >
                                                <RadialBar
                                                    minAngle={15}
                                                    background
                                                    clockWise
                                                    dataKey="value"
                                                    cornerRadius={30}
                                                />
                                            </RadialBarChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pt-4">
                                            <span className="text-3xl font-black text-[#FD295E]">{Math.min(((metrics.wonValue / metrics.goals.revenue) * 100), 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Realizado</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(metrics.wonValue)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Meta</p>
                                            <p className="text-xl font-black text-gray-300 dark:text-gray-600">{formatCurrency(metrics.goals.revenue)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deals Goal */}
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Meta de Volume</h3>
                                        <p className="text-gray-500 dark:text-gray-400">Vendas Fechadas</p>
                                    </div>
                                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                                        <CircleDollarSign className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="w-40 h-40 relative flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadialBarChart
                                                innerRadius="80%"
                                                outerRadius="100%"
                                                startAngle={180}
                                                endAngle={0}
                                                data={[{ name: 'Meta', value: 100, fill: '#f1f5f9' }, { name: 'Realizado', value: Math.min(((metrics.wonCount / metrics.goals.deals) * 100), 100), fill: '#10b981' }]}
                                            >
                                                <RadialBar
                                                    minAngle={15}
                                                    background
                                                    clockWise
                                                    dataKey="value"
                                                    cornerRadius={30}
                                                />
                                            </RadialBarChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pt-4">
                                            <span className="text-3xl font-black text-emerald-600">{Math.min(((metrics.wonCount / metrics.goals.deals) * 100), 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Realizado</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.wonCount} <span className="text-sm text-gray-400 font-medium">vendas</span></p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Meta</p>
                                            <p className="text-xl font-black text-gray-300 dark:text-gray-600">{metrics.goals.deals} <span className="text-sm text-gray-200 dark:text-gray-700 font-medium">vendas</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Leads Goal */}
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Meta de Leads</h3>
                                        <p className="text-gray-500 dark:text-gray-400">Marketing</p>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                                        <Users className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="w-40 h-40 relative flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadialBarChart
                                                innerRadius="80%"
                                                outerRadius="100%"
                                                startAngle={180}
                                                endAngle={0}
                                                data={[{ name: 'Meta', value: 100, fill: '#f1f5f9' }, { name: 'Realizado', value: Math.min(((metrics.leadsCreatedCount / metrics.goals.leads) * 100), 100), fill: '#8b5cf6' }]}
                                            >
                                                <RadialBar
                                                    minAngle={15}
                                                    background
                                                    clockWise
                                                    dataKey="value"
                                                    cornerRadius={30}
                                                />
                                            </RadialBarChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pt-4">
                                            <span className="text-3xl font-black text-purple-600">{Math.min(((metrics.leadsCreatedCount / metrics.goals.leads) * 100), 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Realizado</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.leadsCreatedCount} <span className="text-sm text-gray-400 font-medium">leads</span></p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Meta</p>
                                            <p className="text-xl font-black text-gray-300 dark:text-gray-600">{metrics.goals.leads} <span className="text-sm text-gray-200 dark:text-gray-700 font-medium">leads</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Team Goals */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Performance do Time vs Meta</h3>
                                <button onClick={() => setActiveTab('sdr')} className="text-sm font-bold text-[#FD295E] hover:text-[#e11d48]">Ver Detalhes</button>
                            </div>

                            <div className="space-y-6">
                                {sdrStats.map((sdr, idx) => {
                                    // Determine Goal: Individual > (Global / Count) > Default
                                    const count = sdrStats.length || 1;
                                    const revenueGoal = metrics.goals.revenue || 60000;
                                    const individualGoal = metrics.goals.sdrGoals?.[sdr.name]?.revenue || (revenueGoal / count);

                                    const percent = Math.min((sdr.wonValue / (individualGoal || 1)) * 100, 100);

                                    return (
                                        <div key={idx} className="group">
                                            <div className="flex justify-between items-end mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">
                                                        {sdr.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white">{sdr.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(sdr.wonValue)} realizado</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-gray-900 dark:text-white">{percent.toFixed(0)}%</span>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">meta: {formatCurrency(individualGoal)}</p>
                                                </div>
                                            </div>
                                            <div className="h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#FD295E] rounded-full shadow-[0_0_10px_rgba(253,41,94,0.4)] transition-all duration-1000 group-hover:bg-[#e11d48]"
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )
                }
            </AnimatePresence>

        </div >
    );
}
