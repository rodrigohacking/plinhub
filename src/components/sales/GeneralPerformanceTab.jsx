import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { Target, Users, CircleDollarSign, Ban, BarChart as BarChartIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/utils';
import { GoalProgress } from '../GoalProgress';
import { TOOLTIP_STYLE, GRID_PROPS, AXIS_TICK, AXIS_SHARED } from '../../lib/chartTheme';

export const GeneralPerformanceTab = memo(function GeneralPerformanceTab({ metrics, company, tabVariants, filteredDeals, createdDeals, isMobile }) {
    const [filterChannel, setFilterChannel] = useState('all');
    const [filterInsuranceType, setFilterInsuranceType] = useState('all');
    const [sortOption, setSortOption] = useState('date-desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    if (!metrics) return null;

    // Helper Products
    const normalizeProduct = (val) => {
        if (!val) return 'Não Identificado';
        let str = String(val).toUpperCase().trim();
        if (str.includes('VIDA')) return 'VIDA';
        if (str.includes('AUTO') || str.includes('FROTA')) return 'AUTO';
        if (str.includes('RESIDENCIAL') || str.includes('EMPRESARIAL') || str.includes('CONDOM')) return 'PATRIMONIAL';
        if (str.includes('SAUDE') || str.includes('SAÚDE') || str.includes('ODONTO')) return 'SAÚDE/ODONTO';
        if (str.includes('RC') || str.includes('RESPONSABILIDADE')) return 'RCP';
        if (str.includes('GARANTIA')) return 'GARANTIA';
        if (str.includes('EQUIPE') || str.includes('MÁQUINA')) return 'RD/EQUIPAMENTOS';
        return 'OUTROS';
    };

    // Derived Insurance stats for Andar
    const calcInsuranceStats = () => {
        if (!(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar'))) {
            return [];
        }

        const metricsObj = {};
        createdDeals.forEach(deal => {
            const prod = normalizeProduct(deal.product || deal.insuranceType);
            if (!metricsObj[prod]) metricsObj[prod] = { total: 0, won: 0, revenue: 0 };
            metricsObj[prod].total++;
        });

        metrics.wonDeals.forEach(deal => {
            const prod = normalizeProduct(deal.product || deal.insuranceType);
            if (!metricsObj[prod]) metricsObj[prod] = { total: 0, won: 0, revenue: 0 };
            metricsObj[prod].won++;
            metricsObj[prod].revenue += (deal.amount || 0);
        });

        return Object.entries(metricsObj)
            .map(([name, stats]) => ({
                name,
                total: stats.total,
                won: stats.won,
                revenue: stats.revenue,
                avgTicket: stats.won > 0 ? stats.revenue / stats.won : 0,
                conversion: stats.total > 0 ? (stats.won / stats.total) * 100 : 0
            }))
            .sort((a, b) => b.won - a.won)
            .filter(i => i.total > 0 || i.won > 0);
    };

    const insuranceStats = calcInsuranceStats();
    const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

    return (
        <motion.div
            key="geral"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-8"
        >
            {/* 1. Hero Banner */}
            <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">Visão Geral</h2>
                <p className="text-[var(--text-secondary)] text-sm mt-1">Resumo estratégico e métricas principais.</p>
            </div>

            {/* 2. Premium KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {/* Card 1: Entraram */}
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Leads Entraram</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground">{metrics.leadsCreatedCount}</h3>
                        </div>
                        <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-muted)] flex-shrink-0" />
                    </div>
                    {metrics.goals?.leads > 0
                        ? <GoalProgress actual={metrics.leadsCreatedCount} target={metrics.goals.leads} format="number" />
                        : (
                            <>
                                <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-full"></div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">Oportunidades</p>
                            </>
                        )
                    }
                </div>

                {/* Card 2: Qualificados */}
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Qualificados</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-indigo-400">{metrics.qualifiedCount}</h3>
                        </div>
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-muted)] flex-shrink-0" />
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 shadow-lg" style={{ width: `${(metrics.qualifiedCount / (metrics.leadsCreatedCount || 1)) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">
                        {((metrics.qualifiedCount / (metrics.leadsCreatedCount || 1)) * 100).toFixed(0)}% Conversão
                    </p>
                </div>

                {/* Card 3: Vendas */}
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Vendas Fechadas</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-green-400">{metrics.wonCount}</h3>
                        </div>
                        <CircleDollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-muted)] flex-shrink-0" />
                    </div>
                    {metrics.goals?.deals > 0
                        ? <GoalProgress actual={metrics.wonCount} target={metrics.goals.deals} format="number" />
                        : (
                            <>
                                <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 shadow-lg" style={{ width: `${(metrics.wonCount / (metrics.qualifiedCount || 1)) * 100}%` }}></div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">
                                    {((metrics.wonCount / (metrics.qualifiedCount || 1)) * 100).toFixed(0)}% Fechamento
                                </p>
                            </>
                        )
                    }
                </div>
                {/* Card 4: Perdidos */}
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Leads Perdidos</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-red-400">{metrics.lostCount}</h3>
                        </div>
                        <Ban className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-muted)] flex-shrink-0" />
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 shadow-lg" style={{ width: `${Math.min(metrics.churnRate, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">
                        {metrics.churnRate.toFixed(0)}% Perdidos
                    </p>
                </div>
            </div>

            {/* 3. Financial Cards (Row 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                {/* Faturamento */}
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <CircleDollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-muted)] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-xs sm:text-sm font-bold uppercase tracking-wide truncate">
                                {(company?.name || '').toLowerCase().includes('apolar') ? 'Contratos Fechados' : 'Apólices Fechadas'}
                            </p>
                            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-foreground mt-1">{formatCurrency(metrics.wonValue)}</h3>
                        </div>
                    </div>
                    {metrics.goals?.revenue > 0 && (
                        <div className="mt-4">
                            <GoalProgress actual={metrics.wonValue} target={metrics.goals.revenue} format="currency" />
                        </div>
                    )}
                </div>

                {/* Ticket Médio */}
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] transition-colors duration-200">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <BarChartIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-muted)] flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-muted-foreground text-xs sm:text-sm font-bold uppercase tracking-wide">Ticket Médio</p>
                            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-foreground mt-1">{formatCurrency(metrics.avgTicket)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 3: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] h-[320px] sm:h-[380px] md:h-[400px]">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-foreground">Motivos de Perda</h3>
                        <p className="text-sm text-muted-foreground font-medium">Análise de perdas por motivo</p>
                    </div>
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
                                <defs>
                                    <linearGradient id="gradLossH" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#b91c1c" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...GRID_PROPS} horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} {...AXIS_SHARED} tick={{ ...AXIS_TICK, fontSize: 11 }} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [value, 'Perdas']} />
                                <Bar dataKey="value" fill="url(#gradLossH)" radius={[0, 4, 4, 0]} barSize={24} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                            </BarChart>
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                Nenhuma perda registrada neste período.
                            </div>
                        )}
                    </ResponsiveContainer>
                </div>

                {/* Origem dos Leads - Conditional Display */}
                {(company?.name || '').toLowerCase().includes('apolar') || !(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) ? (
                    // TABLE FORMAT (Apolar and other non-insurance companies)
                    <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] h-[320px] sm:h-[380px] md:h-[400px] flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-foreground">Origem dos Leads</h3>
                            <p className="text-sm text-muted-foreground font-medium">Distribuição por canal de aquisição</p>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto flex-1">
                            {(() => {
                                const channelMetrics = {};

                                createdDeals.forEach(d => {
                                    const channel = d.channel || 'Não Identificado';
                                    if (!channelMetrics[channel]) {
                                        channelMetrics[channel] = { leads: 0, sales: 0, totalValue: 0 };
                                    }
                                    channelMetrics[channel].leads += 1;
                                });

                                metrics.wonDeals.forEach(d => {
                                    const channel = d.channel || 'Não Identificado';
                                    if (!channelMetrics[channel]) {
                                        channelMetrics[channel] = { leads: 0, sales: 0, totalValue: 0 };
                                    }
                                    channelMetrics[channel].sales += 1;
                                    channelMetrics[channel].totalValue += d.amount || 0;
                                });

                                const channelData = Object.entries(channelMetrics)
                                    .map(([name, data]) => ({
                                        name,
                                        leads: data.leads,
                                        sales: data.sales,
                                        avgTicket: data.sales > 0 ? data.totalValue / data.sales : 0,
                                        conversion: data.leads > 0 ? (data.sales / data.leads) * 100 : 0
                                    }))
                                    .sort((a, b) => b.leads - a.leads);

                                const channelColors = {
                                    'META ADS': '#3b82f6',
                                    'HARDROCK': '#06b6d4',
                                    'DISCADOR': '#8b5cf6',
                                    'BOT': '#a855f7',
                                    'OUT': '#ec4899',
                                    'ORGÂNICO IG': '#10b981',
                                    'PARCEIROS': '#f59e0b',
                                    'Outros': '#6b7280'
                                };

                                return (
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canal</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leads</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendas</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">T. Médio</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conv.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {channelData.map((channel) => {
                                                const color = channelColors[channel.name] || '#6b7280';
                                                return (
                                                    <tr key={channel.name} className="border-b border-border hover:bg-muted/50 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                                <span className="font-semibold text-foreground text-sm">{channel.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className="font-bold text-foreground text-sm">{formatNumber(channel.leads)}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className="font-bold text-foreground text-sm">{formatNumber(channel.sales)}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className="font-bold text-foreground text-sm">{formatCurrency(channel.avgTicket)}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${channel.conversion > 0
                                                                ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-muted text-muted-foreground'
                                                                }`}>
                                                                {formatPercent(channel.conversion)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    // PIE CHART (Andar Seguros) - rosca refinada com label central
                    <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] h-[320px] sm:h-[380px] md:h-[400px]">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-foreground">Origem das Vendas</h3>
                            <p className="text-sm text-muted-foreground font-medium">Distribuição por canal de aquisição</p>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                {(() => {
                                    const counts = {};
                                    metrics.wonDeals.forEach(d => {
                                        const ch = d.channel || 'Desconhecido';
                                        counts[ch] = (counts[ch] || 0) + 1;
                                    });
                                    let pieData = Object.keys(counts).map(k => ({ name: k, value: counts[k] })).sort((a, b) => b.value - a.value);
                                    if (pieData.length > 5) {
                                        const top5 = pieData.slice(0, 5);
                                        const others = pieData.slice(5).reduce((acc, curr) => acc + curr.value, 0);
                                        if (others > 0) top5.push({ name: 'Outros', value: others });
                                        pieData = top5;
                                    }
                                    const total = pieData.reduce((s, d) => s + d.value, 0);
                                    return (
                                        <>
                                            <Pie
                                                data={pieData}
                                                cx="35%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={3}
                                                dataKey="value"
                                                isAnimationActive={true}
                                                animationDuration={600}
                                                animationEasing="ease-out"
                                            >
                                                {pieData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <text x="35%" y="46%" textAnchor="middle" dominantBaseline="middle" fill="#fafafa" fontSize={22} fontWeight={700}>{total}</text>
                                            <text x="35%" y="57%" textAnchor="middle" dominantBaseline="middle" fill="#71717a" fontSize={11}>vendas</text>
                                        </>
                                    );
                                })()}
                                <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [value, name]} />
                                <Legend verticalAlign={isMobile ? 'bottom' : 'middle'} align={isMobile ? 'center' : 'right'} layout={isMobile ? 'horizontal' : 'vertical'} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: isMobile ? '20px' : '0', color: '#71717a' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) && (
                <div className="grid grid-cols-1 gap-6 mt-6">
                    <div className="bg-card p-6 rounded-3xl border border-border shadow-xl h-[400px] overflow-hidden flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-foreground">Conversão por Seguro</h3>
                            <p className="text-sm text-muted-foreground font-medium">Eficiência por produto (Vendas / Leads)</p>
                        </div>
                        <div className="overflow-y-auto flex-1 pr-2">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-muted/50">
                                    <tr>
                                        <th className="px-3 py-3 rounded-tl-lg">Produto</th>
                                        <th className="px-3 py-3 text-right">Leads</th>
                                        <th className="px-3 py-3 text-right">Vendas</th>
                                        <th className="px-3 py-3 text-right">Ticket Médio</th>
                                        <th className="px-3 py-3 text-right rounded-tr-lg">Conv.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {insuranceStats.map((stat, i) => (
                                        <tr key={i} className="hover:bg-muted/50">
                                            <td className="px-3 py-3 font-medium text-foreground text-xs">{stat.name}</td>
                                            <td className="px-3 py-3 text-right text-muted-foreground">{stat.total}</td>
                                            <td className="px-3 py-3 text-right text-green-600 font-bold">{stat.won}</td>
                                            <td className="px-3 py-3 text-right text-foreground font-medium">{formatCurrency(stat.avgTicket)}</td>
                                            <td className="px-3 py-3 text-right">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${stat.conversion >= 10 ? 'bg-green-500/20 text-green-400' :
                                                    stat.conversion >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {stat.conversion.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 4: Últimas Vendas ("Recent Sales" Table) */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-4 sm:p-6 md:p-8 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Histórico de Vendas</h3>
                        <p className="text-sm text-muted-foreground font-medium">Registro detalhado de fechamentos</p>
                    </div>

                    {/* Filter and Sort Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* Channel Filter */}
                        <select
                            value={filterChannel}
                            onChange={(e) => {
                                setFilterChannel(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] block p-2.5 outline-none transition-colors [color-scheme:dark]"
                        >
                            <option value="all">Todos os Canais</option>
                            {Array.from(new Set(metrics.wonDeals?.map(d => d.channel || 'Desconhecido') || [])).map(ch => (
                                <option key={ch} value={ch}>{ch}</option>
                            ))}
                        </select>

                        {/* INSURANCE TYPE FILTER */}
                        {(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) && (
                            <select
                                value={filterInsuranceType}
                                onChange={(e) => {
                                    setFilterInsuranceType(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] block p-2.5 outline-none transition-colors [color-scheme:dark]"
                            >
                                <option value="all">Todos os Seguros</option>
                                {Array.from(new Set(metrics.wonDeals?.map(d => normalizeProduct(d.product || d.insuranceType)) || [])).filter(t => t !== 'Não Identificado').sort().map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        )}

                        {/* Sort Control */}
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] block p-2.5 outline-none transition-colors [color-scheme:dark]"
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
                        <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Cliente / Título</th>
                                <th className="px-6 py-4">Vendedor</th>
                                <th className="px-6 py-4">Canal</th>
                                {(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) && (
                                    <th className="px-6 py-4">Tipo Seguro</th>
                                )}
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(() => {
                                let tableData = [...(metrics.wonDeals || [])];

                                if (filterChannel !== 'all') {
                                    tableData = tableData.filter(d => (d.channel || 'Desconhecido') === filterChannel);
                                }
                                if (filterInsuranceType !== 'all') {
                                    tableData = tableData.filter(d => normalizeProduct(d.product || d.insuranceType) === filterInsuranceType);
                                }

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

                                const startIndex = (currentPage - 1) * itemsPerPage;
                                const currentData = tableData.slice(startIndex, startIndex + itemsPerPage);

                                if (currentData.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground">
                                                Nenhuma venda encontrada com estes filtros.
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <>
                                        {currentData.map((deal) => (
                                            <tr key={deal.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {(() => {
                                                        const raw = deal.won_date || deal.date || deal.createdAt || '';
                                                        const datePart = String(raw).split('T')[0];
                                                        const p = datePart.split('-');
                                                        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : raw;
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-foreground">
                                                    {deal.client || deal.title}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {(deal.seller || 'N/A').replace(/[\[\]"]/g, '').trim()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-muted text-foreground whitespace-nowrap">
                                                        {deal.channel || 'N/A'}
                                                    </span>
                                                </td>
                                                {(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) && (
                                                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                                                        {normalizeProduct(deal.product || deal.insuranceType)}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 font-bold text-foreground">
                                                    {formatCurrency(deal.amount)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-bold uppercase bg-green-500/20 text-green-400">
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
                    let tableData = [...(metrics.wonDeals || [])];
                    if (filterChannel !== 'all') {
                        tableData = tableData.filter(d => (d.channel || 'Desconhecido') === filterChannel);
                    }
                    if (filterInsuranceType !== 'all') {
                        tableData = tableData.filter(d => normalizeProduct(d.product || d.insuranceType) === filterInsuranceType);
                    }

                    const totalItems = tableData.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage);

                    if (totalItems > 0) {
                        return (
                            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-border bg-muted/30 gap-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>Linhas por página:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-background border border-border rounded-md text-sm p-1 focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>
                                        Página {currentPage} de {totalPages || 1}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="p-1 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
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
});
