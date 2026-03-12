import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Legend } from 'recharts';
import { Users, CircleDollarSign, Clock, Percent } from 'lucide-react';
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
            {/* 1. Hero Banner (SDR Theme - Violet/Dark) */}
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-900 rounded-2xl md:rounded-3xl p-5 sm:p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 tracking-tight text-white">Performance do Time</h2>
                        <p className="text-violet-100 text-sm sm:text-base md:text-lg">Análise detalhada de produtividade e conversão.</p>
                    </div>
                    <div className="flex gap-3 sm:gap-4">
                        <div className="bg-white/10 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-white/20">
                            <p className="text-xs uppercase font-bold text-violet-200 mb-1">SDRs Ativos</p>
                            <p className="text-xl sm:text-2xl font-black text-white">{sdrStats.length}</p>
                        </div>
                    </div>
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
                            rankColor = "bg-yellow-100 text-yellow-700 border-yellow-200 shadow-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400";
                            cardStyle = "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-900/10";
                            barColor = "bg-yellow-500";
                        }
                        if (index === 1) {
                            rankColor = "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
                            cardStyle = "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30";
                            barColor = "bg-slate-500";
                        }
                        if (index === 2) {
                            rankColor = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400";
                            cardStyle = "border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-900/10";
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
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-green-600 dark:text-green-400">{metrics.wonCount}</h3>
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
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-orange-500 dark:text-orange-400">{metrics.avgClosingTime?.toFixed(1) || 0} <span className="text-sm sm:text-lg text-muted-foreground font-medium">dias</span></h3>
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
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-purple-600 dark:text-purple-400">{formatPercent(metrics.conversionRate)}</h3>
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
                    <h3 className="text-xl font-bold text-foreground">Performance Individual dos SDR's</h3>
                    <p className="text-sm text-muted-foreground font-medium">Análise detalhada por representante</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 h-auto md:h-[350px]">
                    {/* Conversion by SDR */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border h-[300px] md:h-full">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-6">Taxa de Conversão</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={[...sdrStats].sort((a, b) => b.conversion - a.conversion)} margin={{ bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    fontSize={10}
                                    tick={{ fill: '#64748b', angle: -20, textAnchor: 'end' }}
                                    interval={0}
                                    height={40}
                                />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value) => [`${value.toFixed(1)}%`, 'Conversão']}
                                    cursor={{ fill: 'var(--muted)' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="conversion" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Avg Time by SDR */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border h-[300px] md:h-full">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-6">Tempo Médio (Dias)</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={[...sdrStats].sort((a, b) => a.avgTime - b.avgTime)} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)' }}
                                    formatter={(value) => [`${value.toFixed(1)} dias`, 'Tempo Médio']}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="avgTime" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Sales Value by SDR */}
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border h-[300px] md:h-full">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-6">Valor de Vendas</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={sdrStats} margin={{ bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    fontSize={10}
                                    tick={{ fill: '#64748b', angle: -20, textAnchor: 'end' }}
                                    interval={0}
                                    height={40}
                                />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value), 'Vendas']}
                                    cursor={{ fill: 'var(--muted)' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="wonValue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
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
                                        className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <span className="text-3xl font-black text-foreground z-10">{gauge.val.toFixed(0)}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. Section: Motivos de Perda */}
            <div className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-border h-[350px] sm:h-[400px] md:h-[450px] flex flex-col">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-foreground">Motivos de Perda (Detalhado)</h3>
                    <p className="text-sm text-muted-foreground font-medium">Principais razões de churn</p>
                </div>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sdrStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                            <YAxis tick={{ fill: '#64748b' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: 'var(--muted)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', color: 'var(--foreground)' }} />
                            {(() => {
                                const allReasons = new Set();
                                sdrStats.forEach(s => {
                                    Object.keys(s.lostReasons || {}).forEach(r => allReasons.add(r));
                                });
                                const reasonsList = Array.from(allReasons);
                                const REASON_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

                                return reasonsList.map((reason, idx) => (
                                    <Bar
                                        key={reason}
                                        dataKey={`lostReasons.${reason}`}
                                        name={reason}
                                        stackId="a"
                                        fill={REASON_COLORS[idx % REASON_COLORS.length]}
                                        radius={idx === reasonsList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                    />
                                ));
                            })()}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </motion.div>
    );
});
