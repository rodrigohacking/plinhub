import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { SidebarNew } from './SidebarNew';
import { AnimatePresence, motion } from 'framer-motion';

export function Layout({ children, currentView, onViewChange, company }) {
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={cn(
            "flex flex-row h-[100dvh] overflow-hidden font-sans transition-colors duration-300",
            "bg-[var(--bg-page)]"
        )}>
            <SidebarNew
                currentView={currentView}
                onNavigate={onViewChange}
                company={company}
            />

            {/* Main content area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
                <div className="max-w-[1440px] mx-auto min-h-full p-4 md:p-6">
                    {isMobile ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentView}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <div className="h-full">{children}</div>
                    )}
                </div>
            </main>
        </div>
    );
}
