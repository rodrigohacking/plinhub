import React from 'react';

export function ChartCard({ title, subtitle, children, className }) {
    return (
        <div className={`bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 ${className || ''}`}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
                {subtitle && <p className="text-sm text-[var(--text-secondary)] mt-1">{subtitle}</p>}
            </div>
            <div className="w-full">
                {children}
            </div>
        </div>
    );
}
