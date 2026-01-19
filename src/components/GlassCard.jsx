import React from 'react';

export const GlassCard = ({ children, className = '' }) => (
    <div className={`bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-gray-200/50 dark:shadow-black/50 overflow-hidden ${className}`}>
        {children}
    </div>
);
