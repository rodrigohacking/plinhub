import React from 'react';
import { cn } from '../lib/utils';
import { SidebarNew } from './SidebarNew';
import { AnimatePresence, motion } from 'framer-motion';

export function Layout({ children, currentView, onViewChange, company }) {
    // Detect mobile for animation preference
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

    return (
        <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden bg-gray-50 dark:bg-black font-sans transition-colors duration-300">
            <SidebarNew
                currentView={currentView}
                onNavigate={onViewChange}
                company={company}
            />
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto h-full">
                    {/* Page Transition - Mobile Only & Subtle */}
                    {isMobile ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentView}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }} // Fluid but fast
                                className="h-full"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <div className="h-full">
                            {children}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
