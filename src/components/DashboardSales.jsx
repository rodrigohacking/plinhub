import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { Target, Ban, CircleDollarSign, AlertCircle, BarChart as BarChartIcon, Clock, Users, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import { KPICard } from './KPICard';
import { ChartCard } from './ChartCard';
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { DateRangeFilter, filterByDateRange, isDateInSelectedRange } from './DateRangeFilter';
import { SDRPerformanceTab } from './sales/SDRPerformanceTab';
import { GeneralPerformanceTab } from './sales/GeneralPerformanceTab';

export function DashboardSales({ company, data, dateRange, setDateRange }) {
    // dateRange comes from App.jsx (global persistence)

    // Helper: Normalize Insurance Product Names (Global)
    const normalizeProduct = (val) => {
        if (!val || val === 'null' || val === 'undefined' || val === '-') return 'Não Identificado';
        const v = String(val).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        
        // Priority Mapping
        if (v.includes('condomin')) return 'Condominial';
        if (v.includes('sindico') || v.includes('rc_sindico')) return 'RC Síndico';
        if (v.includes('auto')) return 'Automóvel';
        if (v.includes('residenc')) return 'Residencial';
        if (v.includes('vida')) return 'Vida';
        if (v.includes('empresa')) return 'Empresarial';
        if (v.includes('administradora')) return 'Administradora';
        
        // Clean up underscores and capitalize if no match
        return String(val).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Initialize tab from URL or default to 'geral'
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('tab') || 'geral';
        }
        return 'geral';
    });

    // Helper to change tab and update URL
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        const url = new URL(window.location);

        if (tab === 'geral') {
            url.searchParams.delete('tab');
        } else {
            url.searchParams.set('tab', tab);
        }

        window.history.pushState({}, '', url);
    };
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [sortOption, setSortOption] = useState('date-desc'); // date-desc, date-asc, value-desc, value-asc
    const [filterChannel, setFilterChannel] = useState('all');
    const [filterInsuranceType, setFilterInsuranceType] = useState('all');
    const [isMobile, setIsMobile] = useState(false);

    // Reset filters when company changes to avoid stale state from previous company
    useEffect(() => {
        setCurrentPage(1);
        setSortOption('date-desc');
        setFilterChannel('all');
        setFilterInsuranceType('all');
    }, [company?.id]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Filter sales/deals for this company and date range
    // Split filtering logic:
    // 1. createdDeals: Filter by 'createdAt' -> For "Leads Created" metric (Top of Funnel)
    // 2. relevantDeals: Filter by 'date' (wonDate/createdAt) -> For "Sales", "Revenue", "List" (Bottom of Funnel)
    // 3. wonDeals: Filtered by 'wonDate' (actual closing)
    const { allDeals, createdDeals, relevantDeals, wonDeals } = useMemo(() => {
        const filtered = data.sales.filter(s => s.companyId === company.id);
        
        const filteredWonDeals = filtered.filter(d => {
            const effectiveDateStr = d.wonDate || d.won_date || d.date;
            const isWon = d.status === 'won';
            return isWon && isDateInSelectedRange(effectiveDateStr, dateRange);
        });

        return {
            allDeals: filtered,
            createdDeals: filterByDateRange(filtered, dateRange, 'createdAt'),
            relevantDeals: filterByDateRange(filtered, dateRange, 'date'),
            wonDeals: filteredWonDeals
        };
    }, [data.sales, company.id, dateRange]);

    // Use relevantDeals for most charts/tables, EXCEPT for metrics that depend on wonDate
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

        // 4. Vendas Fechadas (Mudar para data de fechamento real)
        const wonCount = wonDeals.length;

        // Goals Logic
        // Use Brazil Timezone for Current Month
        const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

        // Robust finding with type safety
        const currentGoal = data.goals?.find(g => String(g.companyId) === String(company.id) && g.month === currentMonth);

        // Fallback: Find latest goal (Previous months)
        const latestGoal = !currentGoal
            ? (data.goals || [])
                .filter(g => String(g.companyId) === String(company.id) && g.month < currentMonth)
                .sort((a, b) => b.month.localeCompare(a.month))[0]
            : null;

        const goalData = currentGoal || latestGoal;

        console.log("DashboardSales: Goals Lookup", {
            hasGoals: !!data.goals,
            count: data.goals?.length,
            currentMonth,
            companyId: company.id,
            found: !!goalData,
            isFallback: !currentGoal && !!latestGoal,
            usedGoal: goalData
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

        // 5. Churn de Oportunidades
        // Definition: (Lost / Leads Entraram) * 100
        const churnRate = leadsCreatedCount ? (lostCount / leadsCreatedCount) * 100 : 0;

        // SDR Conversion Metrics - Phase-based counts (Conditional by Company)
        const isAndar = String(company.pipefyPipeId) === '306438109' || (company.name || '').toLowerCase().includes('andar');

        let qualifiedPhaseCount, scheduledMeetingCount, proposalSentCount;
        let qualifiedToMeetingRate, meetingToProposalRate, proposalToContractRate;

        if (isAndar) {
            // ANDAR SEGUROS
            // Qualificado: 338889917
            const qualifiedDeals = relevantDeals.filter(d => String(d.phaseId) === '338889917');
            qualifiedPhaseCount = qualifiedDeals.length;

            // Proposta: 338889933
            const proposalDeals = relevantDeals.filter(d => String(d.phaseId) === '338889933');
            proposalSentCount = proposalDeals.length;

            // No "Reunião Agendada" for Andar
            scheduledMeetingCount = 0;

            // Conversion Rates for Andar (only 2 intermediate metrics)
            qualifiedToMeetingRate = 0; // Not used for Andar
            meetingToProposalRate = 0; // Not used for Andar

            // Qualificado → Proposta (for Andar)
            const qualifiedToProposalRate = qualifiedPhaseCount ? (proposalSentCount / qualifiedPhaseCount) * 100 : 0;

            // Proposta → Contrato
            proposalToContractRate = proposalSentCount ? (wonCount / proposalSentCount) * 100 : 0;

            // Store for return
            qualifiedToMeetingRate = qualifiedToProposalRate; // Reuse this variable for Andar's "Qualificado → Proposta"
        } else {
            // APOLAR (and other companies)
            // Qualificado: 333620205
            const qualifiedDeals = relevantDeals.filter(d => String(d.phaseId) === '333620205');
            qualifiedPhaseCount = qualifiedDeals.length;

            // Reunião Agendada: 333789248
            const scheduledMeetingDeals = relevantDeals.filter(d => String(d.phaseId) === '333789248');
            scheduledMeetingCount = scheduledMeetingDeals.length;

            // Proposta Enviada: 333789257
            const proposalSentDeals = relevantDeals.filter(d => String(d.phaseId) === '333789257');
            proposalSentCount = proposalSentDeals.length;

            // Conversion Rates for Apolar
            // Qualificado → Reunião Agendada
            qualifiedToMeetingRate = qualifiedPhaseCount ? (scheduledMeetingCount / qualifiedPhaseCount) * 100 : 0;

            // Reunião Agendada → Proposta Enviada
            meetingToProposalRate = scheduledMeetingCount ? (proposalSentCount / scheduledMeetingCount) * 100 : 0;

            // Proposta → Contrato
            proposalToContractRate = proposalSentCount ? (wonCount / proposalSentCount) * 100 : 0;
        }

        // Lead Novo → Qualificado (same for both companies)
        const leadToQualifiedRate = leadsCreatedCount ? (qualifiedCount / leadsCreatedCount) * 100 : 0;

        return {
            newCount: newDeals.length,
            qualifiedCount, // Calculated formula
            wonCount,
            lostCount,
            wonValue: totalWonValue,
            avgTicket: avgTicket,
            totalDeals,
            conversionRate,
            churnRate, // New Metric
            avgClosingTime,
            leadsCreatedCount, // "Leads Entraram"
            wonDeals, // Exposing Array for Table
            goals, // Dynamic Goals
            // SDR Conversion Metrics
            leadToQualifiedRate,
            qualifiedToMeetingRate,
            meetingToProposalRate,
            proposalToContractRate,
            qualifiedPhaseCount,
            scheduledMeetingCount,
            proposalSentCount
        };
    }, [createdDeals, relevantDeals, wonDeals, data.goals, company.id]);

    // ANDAR SPECIFIC: Insurance Stats (Global)
    const insuranceStats = useMemo(() => {
        const stats = {};


        // 1. Count Created (Total Opportunities)
        createdDeals.forEach(d => {
            const type = normalizeProduct(d.product || d.insuranceType || d.insurance_type);
            if (!stats[type]) stats[type] = { name: type, total: 0, won: 0, open: 0, wonValue: 0 };
            stats[type].total++;
        });

        // 2. Count Won
        metrics.wonDeals.forEach(d => {
            const type = normalizeProduct(d.product || d.insuranceType || d.insurance_type);
            if (!stats[type]) stats[type] = { name: type, total: 0, won: 0, open: 0, wonValue: 0 };
            stats[type].won++;
            stats[type].wonValue = (stats[type].wonValue || 0) + (d.amount || 0);
        });

        return Object.values(stats)
            .map(s => ({
                ...s,
                conversion: s.total ? (s.won / s.total) * 100 : 0,
                avgTicket: s.won ? s.wonValue / s.won : 0 // Calculate Avg Ticket
            }))
            .sort((a, b) => b.won - a.won); // Sort by Won Volume
    }, [createdDeals, metrics.wonDeals]);


    // SDR Agreggations
    const sdrStats = useMemo(() => {
        const map = {};

        // 1. Pass: Helper to init seller
        const initSeller = (name) => {
            if (!map[name]) map[name] = {
                name: name,
                total: 0,       // Leads Generated (Created in period)
                won: 0,         // Deals Won (Won in period)
                wonValue: 0,    // Revenue (Won in period)
                daysSum: 0,
                lostReasons: {},
                insuranceBreakdown: {} // New: Per SDR Product Stats
            };
        };

        // 2. Pass: Count Leads (from createdDeals)
        createdDeals.forEach(d => {
            initSeller(d.seller);
            map[d.seller].total++;

            // Insurance Breakdown (Created)
            const type = normalizeProduct(d.product || d.insuranceType);
            if (!map[d.seller].insuranceBreakdown[type]) map[d.seller].insuranceBreakdown[type] = { total: 0, won: 0 };
            map[d.seller].insuranceBreakdown[type].total++;
        });

        // 3. Pass: Count Sales/Revenue (from wonDeals - filtering for WON)
        // We use wonDeals because it matches the timeframe for "Actual Sales" (wonDate)
        wonDeals.forEach(d => {
            initSeller(d.seller);
            map[d.seller].won++;
            map[d.seller].wonValue += d.amount;
            map[d.seller].daysSum += (d.daysToClose || 0);

            // Insurance Breakdown (Won)
            const type = normalizeProduct(d.product || d.insuranceType);
            if (!map[d.seller].insuranceBreakdown[type]) map[d.seller].insuranceBreakdown[type] = { total: 0, won: 0 };
            map[d.seller].insuranceBreakdown[type].won++;
        });

        // 4. Pass: Count Lost Reasons (from relevantDeals filtered for LOST)
        relevantDeals.filter(d => d.status === 'lost').forEach(d => {
            if (!d.seller) return;
            initSeller(d.seller);
            const reason = d.lossReason || d.loss_reason || 'Sem motivo';
            map[d.seller].lostReasons[reason] = (map[d.seller].lostReasons[reason] || 0) + 1;
        });

        return Object.values(map)
            .filter(s => s.name !== 'Rodrigo Lopes') // Exclude specific non-seller users
            .map(s => ({
                ...s,
                conversion: s.total ? (s.won / s.total) * 100 : 0, // Sales / Leads
                avgTime: s.won ? s.daysSum / s.won : 0
            })).sort((a, b) => b.wonValue - a.wonValue);

    }, [createdDeals, wonDeals, relevantDeals]);

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




    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Header with Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-0">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Vendas</h1>
                    <div className="flex gap-6 text-sm mt-4">
                        <button
                            onClick={() => handleTabChange('geral')}
                            className={`font-semibold pb-4 px-1 border-b-2 transition-colors ${activeTab === 'geral' ? 'text-[#FD295E] border-[#FD295E]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'}`}
                        >
                            Geral
                        </button>
                        <button
                            onClick={() => handleTabChange('sdr')}
                            className={`font-semibold pb-4 px-1 border-b-2 transition-colors ${activeTab === 'sdr' ? 'text-[#FD295E] border-[#FD295E]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'}`}
                        >
                            Vendedores
                        </button>
                        <button
                            onClick={() => handleTabChange('metas')}
                            className={`font-semibold pb-4 px-1 border-b-2 transition-colors ${activeTab === 'metas' ? 'text-[#FD295E] border-[#FD295E]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'}`}
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
                {activeTab === 'geral' && (
                     <GeneralPerformanceTab
                        metrics={metrics}
                        company={company}
                        tabVariants={tabVariants}
                        filteredDeals={filteredDeals}
                        createdDeals={createdDeals}
                        isMobile={isMobile}
                     />
                )}
                {activeTab === 'sdr' && (
                    <SDRPerformanceTab
                        metrics={metrics}
                        sdrStats={sdrStats}
                        company={company}
                        tabVariants={tabVariants}
                    />
                )}
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
                            const capitalizedMonth = currentMonthName ? currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1) : '';

                            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                            const diffTime = Math.abs(endOfMonth - today);
                            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            return (
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">Metas de {capitalizedMonth}</h2>
                                        <p className="text-[var(--text-secondary)] text-sm mt-1">Acompanhamento em tempo real da performance do time.</p>
                                    </div>
                                    <div className="flex gap-2 sm:gap-3">
                                        <div className="bg-[var(--surface-raised)] px-4 py-2 rounded-xl border border-[var(--border)]">
                                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Dias Restantes</p>
                                            <p className="text-lg font-black text-[var(--text-primary)]">{daysRemaining}d</p>
                                        </div>
                                        <div className="bg-[var(--surface-raised)] px-4 py-2 rounded-xl border border-[var(--border)]">
                                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Status Geral</p>
                                            <p className="text-lg font-black text-[var(--success)]">Na Meta</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Main Goals Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                            {/* Revenue Goal */}
                            <div className="bg-[var(--surface)] p-5 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-[var(--text-primary)]">Meta de Faturamento</h3>
                                        <p className="text-[var(--text-secondary)]">Mês Atual</p>
                                    </div>
                                    <Target className="w-5 h-5 text-[var(--text-muted)]" />
                                </div>

                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-40 h-40 relative flex items-center justify-center shrink-0">
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
                                            <span className="text-3xl font-black text-[#FD295E]">{((metrics.wonValue / metrics.goals.revenue) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Realizado</p>
                                            <p className="text-xl font-black text-[var(--text-primary)]">{formatCurrency(metrics.wonValue)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Meta</p>
                                            <p className="text-xl font-black text-[var(--text-muted)]">{formatCurrency(metrics.goals.revenue)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deals Goal */}
                            <div className="bg-[var(--surface)] p-5 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-[var(--text-primary)]">Meta de Volume</h3>
                                        <p className="text-[var(--text-secondary)]">Vendas Fechadas</p>
                                    </div>
                                    <CircleDollarSign className="w-5 h-5 text-[var(--text-muted)]" />
                                </div>

                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-40 h-40 relative flex items-center justify-center shrink-0">
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
                                            <span className="text-3xl font-black text-emerald-600">{((metrics.wonCount / metrics.goals.deals) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Realizado</p>
                                            <p className="text-xl font-black text-[var(--text-primary)]">{metrics.wonCount} <span className="text-sm text-[var(--text-muted)] font-medium">vendas</span></p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Meta</p>
                                            <p className="text-xl font-black text-[var(--text-muted)]">{metrics.goals.deals} <span className="text-sm text-[var(--text-muted)] font-medium">vendas</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Leads Goal */}
                            <div className="bg-[var(--surface)] p-5 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-[var(--text-primary)]">Meta de Leads</h3>
                                        <p className="text-[var(--text-secondary)]">Marketing</p>
                                    </div>
                                    <Users className="w-5 h-5 text-[var(--text-muted)]" />
                                </div>

                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-40 h-40 relative flex items-center justify-center shrink-0">
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
                                            <span className="text-3xl font-black text-purple-600">{((metrics.leadsCreatedCount / metrics.goals.leads) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Realizado</p>
                                            <p className="text-xl font-black text-[var(--text-primary)]">{metrics.leadsCreatedCount} <span className="text-sm text-[var(--text-muted)] font-medium">leads</span></p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Meta</p>
                                            <p className="text-xl font-black text-[var(--text-muted)]">{metrics.goals.leads} <span className="text-sm text-[var(--text-muted)] font-medium">leads</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Team Goals */}
                        <div className="bg-[var(--surface)] p-4 sm:p-6 md:p-8 rounded-2xl border border-[var(--border)]">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Performance do Time vs Meta</h3>
                                <button onClick={() => handleTabChange('sdr')} className="text-sm font-bold text-[#FD295E] hover:text-[#e11d48]">Ver Detalhes</button>
                            </div>

                            <div className="space-y-6">
                                {sdrStats.map((sdr, idx) => {
                                    // Determine Goal: Individual > (Global / Count) > Default
                                    const count = sdrStats.length || 1;
                                    const revenueGoal = metrics.goals.revenue || 60000;
                                    const individualGoal = metrics.goals.sdrGoals?.[sdr.name]?.revenue || (revenueGoal / count);

                                    const percent = (sdr.wonValue / (individualGoal || 1)) * 100;
                                    const visualPercent = Math.min(percent, 100);

                                    return (
                                        <div key={idx} className="group">
                                            <div className="flex justify-between items-end mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-[var(--surface-raised)] flex items-center justify-center font-bold text-[var(--text-secondary)]">
                                                        {sdr.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-[var(--text-primary)]">{sdr.name}</p>
                                                        <p className="text-xs text-[var(--text-secondary)]">{formatCurrency(sdr.wonValue)} realizado</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-[var(--text-primary)]">{percent.toFixed(0)}%</span>
                                                    <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">meta: {formatCurrency(individualGoal)}</p>
                                                </div>
                                            </div>
                                            <div className="h-3 w-full bg-[var(--surface-raised)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#FD295E] rounded-full shadow-[0_0_10px_rgba(253,41,94,0.4)] transition-all duration-1000 group-hover:bg-[#e11d48]"
                                                    style={{ width: `${visualPercent}%` }}
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
