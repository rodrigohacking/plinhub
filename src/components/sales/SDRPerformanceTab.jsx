import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Legend, Cell } from 'recharts';
import { TOOLTIP_STYLE, GRID_PROPS, AXIS_TICK, AXIS_SHARED, barRadius, MAX_BAR_SIZE, BAR_BG } from '../../lib/chartTheme';
import { Users, CircleDollarSign, Clock, Percent, Ban } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../lib/utils';

export const SDRPerformanceTab = memo(function SDRPerformanceTab({ metrics, sdrStats, company, tabVariants }) {
    if (!metrics || !sdrStats) return null;

    return (
        <motion.div
            key="sdr-view-v2"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-8"
        >
            {/* 1. Hero Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">Vendedores — Performance</h2>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">Análise detalhada de produtividade e conversão.</p>
                </div>
                <div className="bg-[var(--surface-raised)] px-4 py-2 rounded-xl border border-[var(--border)]">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Vendedores Ativos</p>
                    <p className="text-lg font-black text-[var(--text-primary)]">{sdrStats.length}</p>
                </div>
            </div>

            {/* 1.5 Competitive Ranking */}
            <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    🏆 Ranking de Vendedores
                </h3>
                <div className="space-y-4">
                    {sdrStats.sort((a, b) => b.wonValue - a.wonValue).map((sdr, index) => {
                        const count = sdrStats.length || 1;
                        const revenueGoal = metrics.goals?.revenue || 60000;
                        const individualGoal = metrics.goals?.sdrGoals?.[sdr.name]?.revenue || (revenueGoal / count);
                        const percent = (sdr.wonValue / (individualGoal || 1)) * 100;
                        const visualPercent = Math.min(percent, 100);

                        let rankColor = "bg-muted text-muted-foreground";
                        let rankBorder = "border-transparent";
                        let cardStyle = "border-border hover:bg-muted/50";
                        let barColor = "bg-primary";

                        if (index === 0) {
                            rankColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
                            cardStyle = "border-yellow-500/20 bg-yellow-500/5";
                            barColor = "bg-yellow-500";
                        }
                        if (index === 1) {
                            rankColor = "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]";
                            cardStyle = "border-[var(--border)] bg-[var(--surface-raised)]";
                            barColor = "bg-slate-500";
                        }
                        if (index === 2) {
                            rankColor = "bg-orange-500/20 text-orange-400 border-orange-500/30";
                            cardStyle = "border-orange-500/20 bg-orange-500/5";
                            barColor = "bg-orange-500";
                        }

                        return (
                            <div key={index} className={`flex items-center gap-4 p-4 rounded-2xl border ${cardStyle} transition-all`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 ${rankColor}`}>
                                    {index + 1}º
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <p className="font-bold text-foreground text-lg truncate">{sdr.name}</p>
                                        <div className="text-right">
                                            <p className="font-black text-foreground">{formatCurrency(sdr.wonValue)}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Meta: {formatCurrency(individualGoal)}</p>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${barColor} shadow-lg`}
                                            style={{ width: `${visualPercent}%` }}
                                        ></div>
                                    </div>

                                    {/* ANDAR SPECIFIC: Product Conversion Breakdown */}
                                    {(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) && (
                                        <div className="mt-4 pt-3 border-t border-border">
                                            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Conversão por Produto</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {Object.entries(sdr.insuranceBreakdown || {})
                                                    .map(([type, stats]) => ({
                                                        type,
                                                        ...stats,
                                                        conv: (stats.total || stats.won) ? (stats.won / (stats.total || stats.won)) * 100 : 0
                                                    }))
                                                    .filter(i => i.total > 0 || i.won > 0)
                                                    .sort((a, b) => b.won - a.won)
                                                    .slice(0, 4)
                                                    .map((item, i) => (
                                                        <div key={i} className="bg-muted/50 rounded-lg p-2 text-xs">
                                                            <div className="font-semibold text-foreground truncate mb-1">{item.type}</div>
                                                            <div className="flex justify-between items-end">
                                                                <span className={`font-bold ${item.conv > 10 ? 'text-green-600' : 'text-blue-500'}`}>
                                                                    {item.conv.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 2. KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {/* Card 1: Leads Atendidos */}
                <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Leads Atendidos</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground">{metrics.leadsCreatedCount}</h3>
                        </div>
                        <div className="p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl text-primary">
                            <Users className="w-4 h-4 sm:w-6 sm:h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-full"></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">Volume Total</p>
                </div>

                {/* Card 2: Vendas Fechadas */}
                <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Vendas Fechadas</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-green-400">{metrics.wonCount}</h3>
                        </div>
                        <div className="p-2 sm:p-3 bg-green-500/10 rounded-xl sm:rounded-2xl text-green-600">
                            <CircleDollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-full"></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">Sucesso Absoluto</p>
                </div>

                {/* Card 3: Tempo Médio */}
                <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Tempo Médio</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-orange-400">
                                {metrics.avgClosingTime ? <>{metrics.avgClosingTime.toFixed(1)} <span className="text-sm sm:text-lg text-muted-foreground font-medium">dias</span></> : '–'}
                            </h3>
                        </div>
                        <div className="p-2 sm:p-3 bg-orange-500/10 rounded-xl sm:rounded-2xl text-orange-500">
                            <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 w-1/2"></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">Ciclo de Venda</p>
                </div>

                {/* Card 4: Taxa Conversão */}
                <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-3 sm:mb-6">
                        <div>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-1">Conversão Global</p>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-purple-400">{formatPercent(metrics.conversionRate)}</h3>
                        </div>
                        <div className="p-2 sm:p-3 bg-purple-500/10 rounded-xl sm:rounded-2xl text-purple-600">
                            <Percent className="w-4 h-4 sm:w-6 sm:h-6" />
                        </div>
                    </div>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${Math.min(metrics.conversionRate || 0, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 sm:mt-3 font-bold uppercase">Eficiência do Time</p>
                </div>
            </div>

            {/* 3. Section: Performance Individual */}
            <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border">
                <div className="mb-5 sm:mb-8">
                    <h3 className="text-xl font-bold text-foreground">Performance Individual dos Vendedores</h3>
                    <p className="text-sm text-muted-foreground font-medium">Análise detalhada por representante</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 h-auto md:h-[350px]">
                    {/* Conversion by SDR */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border h-[300px] md:h-full">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-6">Taxa de Conversão</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={[...sdrStats].sort((a, b) => b.conversion - a.conversion)} margin={{ bottom: 20 }}>
                                <defs>
                                    <linearGradient id="gradConversion" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#5b21b6" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...GRID_PROPS} />
                                <XAxis dataKey="name" {...AXIS_SHARED} fontSize={10} tick={{ ...AXIS_TICK, angle: -20, textAnchor: 'end' }} interval={0} height={40} />
                                <YAxis hide />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [`${value.toFixed(1)}%`, 'Taxa de Conversão']} />
                                <Bar dataKey="conversion" fill="url(#gradConversion)" radius={barRadius} maxBarSize={MAX_BAR_SIZE} background={BAR_BG} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Avg Time by SDR */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border h-[300px] md:h-full">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-6">Tempo Médio (Dias)</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={[...sdrStats].sort((a, b) => a.avgTime - b.avgTime)} layout="vertical" margin={{ left: 10 }}>
                                <defs>
                                    <linearGradient id="gradTime" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#b45309" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...GRID_PROPS} horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} {...AXIS_SHARED} fontSize={10} tick={AXIS_TICK} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [`${value.toFixed(1)} dias`, 'Tempo Médio']} />
                                <Bar dataKey="avgTime" fill="url(#gradTime)" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Sales Value by SDR */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border h-[300px] md:h-full">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-6">Valor de Vendas</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={sdrStats} margin={{ bottom: 20 }}>
                                <defs>
                                    <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#065f46" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...GRID_PROPS} />
                                <XAxis dataKey="name" {...AXIS_SHARED} fontSize={10} tick={{ ...AXIS_TICK, angle: -20, textAnchor: 'end' }} interval={0} height={40} />
                                <YAxis hide />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [formatCurrency(value), 'Valor de Vendas']} />
                                <Bar dataKey="wonValue" fill="url(#gradSales)" radius={barRadius} maxBarSize={MAX_BAR_SIZE} background={BAR_BG} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 4. Section: Funnel Gauges */}
            <div>
                <div className="mb-6 px-2">
                    <h3 className="text-xl font-bold text-foreground">Conversão entre Etapas</h3>
                    <p className="text-sm text-muted-foreground font-medium">Eficiência do funil de vendas</p>
                </div>
                <div className={`grid grid-cols-1 md:grid-cols-2 ${(String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar')) ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
                    {(() => {
                        const isAndar = String(company?.pipefyPipeId) === '306438109' || (company?.name || '').toLowerCase().includes('andar');

                        if (isAndar) {
                            return [
                                { label: 'Lead Novo → Qualificado', val: metrics.leadToQualifiedRate || 0, color: '#3b82f6' },
                                { label: 'Qualificado → Proposta', val: metrics.qualifiedToMeetingRate || 0, color: '#8b5cf6' },
                                { label: 'Proposta → Contrato', val: metrics.proposalToContractRate || 0, color: '#10b981' },
                            ];
                        } else {
                            return [
                                { label: 'Lead Novo → Qualificado', val: metrics.leadToQualifiedRate || 0, color: '#3b82f6' },
                                { label: 'Qualificado → Reunião Agendada', val: metrics.qualifiedToMeetingRate || 0, color: '#8b5cf6' },
                                { label: 'Reunião Agendada → Proposta Enviada', val: metrics.meetingToProposalRate || 0, color: '#f59e0b' },
                                { label: 'Proposta → Contrato', val: metrics.proposalToContractRate || 0, color: '#10b981' },
                            ];
                        }
                    })().map((gauge, idx) => (
                        <div key={idx} className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-border shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-wide text-center">{gauge.label}</h3>
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                {/* Gauge Background */}
                                <div className="absolute inset-0 rounded-full border-[12px] border-muted"></div>
                                {/* Gauge Value com glow sutil */}
                                <svg
                                    className="absolute inset-0 w-full h-full -rotate-90"
                                    style={{ filter: gauge.val > 0 ? `drop-shadow(0 0 8px ${gauge.color}66)` : 'none' }}
                                >
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="52"
                                        fill="transparent"
                                        stroke={gauge.color}
                                        strokeWidth="12"
                                        strokeDasharray={`${(Math.min(gauge.val, 100) / 100) * (2 * Math.PI * 52)} 1000`}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <span className="text-3xl font-black text-foreground z-10">{gauge.val.toFixed(0)}%</span>
                            </div>
                            <p className="text-[11px] text-[#71717a] mt-3 text-center font-medium">conversão na etapa</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. Section: Motivos de Perda */}
            <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border h-[350px] sm:h-[400px] md:h-[450px] flex flex-col">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-foreground">Motivos de Perda (Detalhado)</h3>
                    <p className="text-sm text-muted-foreground font-medium">Principais razões de perdas</p>
                </div>
                {(() => {
                    const hasAnyReasons = sdrStats.some(s => Object.keys(s.lostReasons || {}).length > 0);
                    if (!hasAnyReasons) {
                        return (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                <Ban className="w-12 h-12 opacity-20" />
                                <p className="text-sm font-medium">Nenhum motivo de perda registrado no período</p>
                            </div>
                        );
                    }
                    return null;
                })()}
                <div className={`flex-1 w-full ${sdrStats.some(s => Object.keys(s.lostReasons || {}).length > 0) ? '' : 'hidden'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                        {(() => {
                            const allReasons = new Set();
                            sdrStats.forEach(s => {
                                Object.keys(s.lostReasons || {}).forEach(r => allReasons.add(r));
                            });
                            const reasonsList = Array.from(allReasons);
                            const REASON_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

                            // Flatten nested lostReasons into top-level keys for Recharts
                            const flatData = sdrStats.map(s => ({
                                name: s.name,
                                ...Object.fromEntries(
                                    reasonsList.map(r => [r, (s.lostReasons || {})[r] || 0])
                                )
                            }));

                            return (
                                <BarChart data={flatData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.6} vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                                    <YAxis tick={AXIS_TICK} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', color: '#71717a' }} />
                                    {reasonsList.map((reason, idx) => (
                                        <Bar
                                            key={reason}
                                            dataKey={reason}
                                            name={reason}
                                            stackId="a"
                                            fill={REASON_COLORS[idx % REASON_COLORS.length]}
                                            radius={idx === reasonsList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        />
                                    ))}
                                </BarChart>
                            );
                        })()}
                    </ResponsiveContainer>
                </div>
            </div>

        </motion.div>
    );
});
