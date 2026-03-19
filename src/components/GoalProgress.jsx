import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatNumber } from '../lib/utils';

/**
 * GoalProgress — shows goal status badge + progress bar.
 *
 * @param {number}  actual   Current (realized) value
 * @param {number}  target   Goal value
 * @param {'currency'|'number'|'percent'} format  How to display the goal label
 * @param {boolean} inverse  If true, lower = better (e.g. CPL)
 * @param {string}  label    Override the goal label text
 */
export function GoalProgress({ actual, target, format = 'number', inverse = false, label }) {
    if (!target || target === 0 || actual === undefined || actual === null) return null;

    const pct = (actual / target) * 100;

    /* ── STATUS LOGIC ─────────────────────────────────────────── */
    let status, color, bg, barColor, Icon;

    if (!inverse) {
        // Higher is better (leads, revenue, deals, investment)
        if (pct >= 85) {
            status = 'Na meta';
            color = 'text-emerald-400';
            bg = 'bg-emerald-500/15';
            barColor = 'bg-emerald-400';
            Icon = TrendingUp;
        } else if (pct >= 50) {
            status = 'Atenção';
            color = 'text-amber-400';
            bg = 'bg-amber-500/15';
            barColor = 'bg-amber-400';
            Icon = Minus;
        } else {
            status = 'Abaixo';
            color = 'text-red-400';
            bg = 'bg-red-500/15';
            barColor = 'bg-red-400';
            Icon = TrendingDown;
        }
    } else {
        // Lower is better (CPL, CAC)
        if (actual <= target * 1.1) {
            status = 'Na meta';
            color = 'text-emerald-400';
            bg = 'bg-emerald-500/15';
            barColor = 'bg-emerald-400';
            Icon = TrendingUp;
        } else if (actual <= target * 1.5) {
            status = 'Atenção';
            color = 'text-amber-400';
            bg = 'bg-amber-500/15';
            barColor = 'bg-amber-400';
            Icon = Minus;
        } else {
            status = 'Acima';
            color = 'text-red-400';
            bg = 'bg-red-500/15';
            barColor = 'bg-red-400';
            Icon = TrendingDown;
        }
    }

    const formatValue = (v) => {
        switch (format) {
            case 'currency': return formatCurrency(v);
            case 'percent': return `${v.toFixed(1)}%`;
            default: return formatNumber(v);
        }
    };

    // Progress bar width (capped at 100%)
    const barWidth = inverse
        ? Math.min((target / Math.max(actual, 0.01)) * 100, 100)
        : Math.min(pct, 100);

    return (
        <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--text-muted)] truncate">
                    Meta: {label ?? formatValue(target)}
                </span>
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${bg} ${color}`}>
                    <Icon className="w-2.5 h-2.5" />
                    {status}
                </span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: `${Math.max(barWidth, 2)}%` }}
                />
            </div>
        </div>
    );
}
