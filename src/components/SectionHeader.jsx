import React from 'react';

export const SectionHeader = ({ icon: Icon, title, color = "text-gray-900" }) => (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-white/5 ${color}`}>
            <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
    </div>
);
