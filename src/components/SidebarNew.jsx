import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/SidebarFrame";
import {
    BarChart3,
    Megaphone,
    Settings,
    Plus,
    Target,
    Sun,
    Moon,
    User,
    Building2,
    LogOut
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export function SidebarNew({ currentView, onNavigate, company }) {
    const [open, setOpen] = useState(false);
    const { signOut, user } = useAuth();

    // Theme Logic (Reused)
    const [isDark, setIsDark] = React.useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    React.useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    if (!company) return null;

    const handleNav = (view) => {
        onNavigate(view);
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setOpen(false);
        }
    };

    const links = [
        {
            label: "Dashboard Vendas",
            onClick: () => handleNav('sales'),
            current: currentView === 'sales',
            icon: <BarChart3 className={cn("h-5 w-5 flex-shrink-0", currentView === 'sales' ? "text-[#FD295E]" : "text-neutral-700 dark:text-neutral-200")} />,
        },
        {
            label: "Dashboard Marketing",
            onClick: () => handleNav('marketing'),
            current: currentView === 'marketing',
            icon: <Megaphone className={cn("h-5 w-5 flex-shrink-0", currentView === 'marketing' ? "text-[#FD295E]" : "text-neutral-700 dark:text-neutral-200")} />,
        },
        {
            label: "Definir Metas",
            onClick: () => handleNav('set-goals'),
            current: currentView === 'set-goals',
            icon: <Target className={cn("h-5 w-5 flex-shrink-0", currentView === 'set-goals' ? "text-[#FD295E]" : "text-neutral-700 dark:text-neutral-200")} />,
        }
    ];

    const actions = [
        {
            label: "Configurações",
            onClick: () => handleNav('settings'),
            current: currentView === 'settings',
            icon: <Settings className={cn("h-5 w-5 flex-shrink-0", currentView === 'settings' ? "text-[#FD295E]" : "text-neutral-700 dark:text-neutral-200")} />,
        }
    ];

    return (
        <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="justify-between gap-6 bg-white dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-white/5">
                <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                    <Logo company={company} open={open} />

                    <div className="mt-6 flex flex-col gap-2">
                        {links.map((link, idx) => (
                            <SidebarLink key={idx} link={link} className={link.current ? "bg-[#FD295E]/10 rounded-lg text-[#FD295E]" : ""} />
                        ))}
                    </div>

                    <div className="mt-6">
                        <div className="h-px w-full bg-gray-200 dark:bg-white/10 mb-4" />
                        <div className="flex flex-col gap-2">
                            {actions.map((link, idx) => (
                                <SidebarLink key={idx} link={link} className={link.current ? "bg-[#FD295E]/10 rounded-lg text-[#FD295E]" : ""} />
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    {/* Toggle Theme */}
                    <div className="mb-1">
                        <SidebarLink
                            link={{
                                label: isDark ? "Modo Claro" : "Modo Escuro",
                                onClick: () => setIsDark(!isDark),
                                icon: isDark ? (
                                    <Sun className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />
                                ) : (
                                    <Moon className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />
                                ),
                            }}
                        />
                    </div>

                    <SidebarLink
                        link={{
                            label: "Trocar Empresa",
                            onClick: () => onNavigate('home'),
                            icon: (
                                <Building2 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                            ),
                        }}
                    />

                    <SidebarLink
                        link={{
                            label: "Sair",
                            onClick: () => signOut(),
                            icon: (
                                <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                            ),
                        }}
                    />
                    <SidebarLink
                        link={{
                            label: user?.user_metadata?.name || user?.name || "Usuário",
                            onClick: () => onNavigate('profile'),
                            icon: (user?.user_metadata?.photoUrl || user?.photoUrl) ? (
                                <img src={user.user_metadata?.photoUrl || user.photoUrl} alt="User" className="h-5 w-5 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="h-5 w-5 flex-shrink-0 rounded-full bg-gray-200 dark:bg-white/20 flex items-center justify-center font-bold text-[10px] text-gray-700 dark:text-white uppercase">
                                    {(user?.user_metadata?.name?.[0] || user?.name?.[0] || 'U')}
                                </div>
                            ),
                        }}
                    />
                </div>
            </SidebarBody>
        </Sidebar >
    );
}

export const Logo = ({ company, open }) => {
    return (
        <div className="font-normal flex items-center justify-start text-sm text-black py-1 relative z-20 w-auto min-w-[50px] gap-3 mx-2 pl-1">
            {company.logo ? (
                <img src={company.logo} alt={company.name} className="h-9 w-9 rounded-lg object-cover flex-shrink-0 shadow-sm" />
            ) : (
                <div className="h-9 w-9 bg-black dark:bg-white rounded-lg flex-shrink-0" />
            )}
            <motion.span
                animate={{
                    width: open ? "auto" : 0,
                    opacity: open ? 1 : 0
                }}
                className="font-medium text-black dark:text-white whitespace-nowrap overflow-hidden"
            >
                {company.name}
            </motion.span>
        </div>
    );
};
