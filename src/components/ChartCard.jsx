import React from 'react';

export function ChartCard({ title, subtitle, children, className }) {
    return (
        <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            </div>
            <div className="w-full">
                {children}
            </div>
        </div>
    );
}
