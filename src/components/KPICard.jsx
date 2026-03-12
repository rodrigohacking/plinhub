import React from 'react';
import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export function KPICard({
    title,
    value,
    icon: Icon,
    trend,
    trendValue,
    trendLabel = 'vs mês anterior',
    iconColor = "text-blue-500",
    iconBg = "bg-blue-50",
    className,
}) {
    return (
        <div className={cn(
            "bg-white dark:bg-[var(--surface)] rounded-2xl border border-[var(--border)]",
            "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
            "p-5 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-[2px]",
            className
        )}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-xl", iconBg)}>
                        {Icon && <Icon className={cn("w-4 h-4", iconColor)} />}
                    </div>
                </div>
                <Info className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </div>

            {/* Value */}
            <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wide">{title}</p>
                <div className="text-2xl font-bold text-[var(--text-primary)] leading-none tracking-tight">
                    {value}
                </div>
            </div>

            {/* Trend */}
            {trendValue && (
                <div className="flex items-center gap-1.5">
                    <span className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                        trend === 'up'
                            ? "bg-green-50 text-green-600"
                            : trend === 'down'
                                ? "bg-red-50 text-red-500"
                                : "bg-slate-100 text-slate-500"
                    )}>
                        {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        {trend === 'neutral' && <Minus className="w-3 h-3" />}
                        {trendValue}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{trendLabel}</span>
                </div>
            )}
        </div>
    );
}
