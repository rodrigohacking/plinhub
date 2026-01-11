import React from 'react';
import { cn } from '../lib/utils';
import { SidebarNew } from './SidebarNew';

export function Layout({ children, currentView, onViewChange, company }) {
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-black font-sans transition-colors duration-300">
            <SidebarNew
                currentView={currentView}
                onNavigate={onViewChange}
                company={company}
            />
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
