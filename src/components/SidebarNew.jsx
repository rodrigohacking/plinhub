import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart3, Megaphone, Settings, Target,
    Sun, Moon, Building2, LogOut, ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export function SidebarNew({ currentView, onNavigate, company }) {
    const [collapsed, setCollapsed] = useState(true);
    const { signOut, user } = useAuth();

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
            setCollapsed(true);
        }
    };

    const navItems = [
        { label: "Vendas", view: "sales", icon: BarChart3 },
        { label: "Marketing", view: "marketing", icon: Megaphone },
        { label: "Metas", view: "set-goals", icon: Target },
    ];

    const bottomItems = [
        { label: "Configurações", view: "settings", icon: Settings },
    ];

    const userName = user?.user_metadata?.name || user?.name || "Usuário";
    const userPhoto = user?.user_metadata?.photoUrl || user?.photoUrl;
    const userInitial = userName[0]?.toUpperCase() || 'U';

    return (
        <>
            {/* Mobile overlay */}
            {!collapsed && (
                <div
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
                    onClick={() => setCollapsed(true)}
                />
            )}

            <motion.aside
                animate={{ width: collapsed ? 64 : 220 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className={cn(
                    "flex flex-col flex-shrink-0 overflow-hidden z-40",
                    "bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]",
                    "h-[100dvh] sticky top-0",
                    "shadow-[1px_0_0_0_rgba(0,0,0,0.04)]"
                )}
                style={{ willChange: 'width' }}
            >
                {/* ── Logo & Toggle ────────────────────── */}
                <div className="flex items-center justify-between px-3 py-4 border-b border-[var(--border)] min-h-[60px]">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        {company.logo ? (
                            <img
                                src={company.logo}
                                alt={company.name}
                                className="h-8 w-8 rounded-lg object-cover flex-shrink-0 shadow-sm"
                            />
                        ) : (
                            <div className="h-8 w-8 rounded-lg bg-[var(--brand)] flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs font-bold">
                                    {company.name?.[0]?.toUpperCase()}
                                </span>
                            </div>
                        )}
                        <AnimatePresence>
                            {!collapsed && (
                                <motion.span
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -6 }}
                                    transition={{ duration: 0.18 }}
                                    className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap truncate max-w-[128px]"
                                >
                                    {company.name}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="flex-shrink-0 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                    >
                        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.25 }}>
                            <ChevronRight className="w-4 h-4" />
                        </motion.div>
                    </button>
                </div>

                {/* ── Main Nav ─────────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 flex flex-col gap-1">
                    {navItems.map(({ label, view, icon: Icon }) => {
                        const active = currentView === view;
                        return (
                            <NavItem
                                key={view}
                                label={label}
                                icon={Icon}
                                active={active}
                                collapsed={collapsed}
                                onClick={() => handleNav(view)}
                            />
                        );
                    })}
                </nav>

                {/* ── Bottom Section ────────────────────── */}
                <div className="px-2 py-3 border-t border-[var(--border)] flex flex-col gap-1">
                    {bottomItems.map(({ label, view, icon: Icon }) => (
                        <NavItem
                            key={view}
                            label={label}
                            icon={Icon}
                            active={currentView === view}
                            collapsed={collapsed}
                            onClick={() => handleNav(view)}
                        />
                    ))}

                    <NavItem
                        label={isDark ? "Modo Claro" : "Modo Escuro"}
                        icon={isDark ? Sun : Moon}
                        active={false}
                        collapsed={collapsed}
                        onClick={() => setIsDark(!isDark)}
                    />

                    <NavItem
                        label="Trocar Empresa"
                        icon={Building2}
                        active={false}
                        collapsed={collapsed}
                        onClick={() => onNavigate('home')}
                    />

                    <NavItem
                        label="Sair"
                        icon={LogOut}
                        active={false}
                        collapsed={collapsed}
                        onClick={() => signOut()}
                        danger
                    />

                    {/* ── User Avatar ────────────────── */}
                    <button
                        onClick={() => onNavigate('profile')}
                        className={cn(
                            "flex items-center gap-2.5 w-full mt-1 px-2 py-2 rounded-lg",
                            "hover:bg-[var(--surface-hover)] transition-colors text-left"
                        )}
                    >
                        {userPhoto ? (
                            <img src={userPhoto} alt={userName} className="h-7 w-7 rounded-full object-cover flex-shrink-0 ring-2 ring-[var(--border)]" />
                        ) : (
                            <div className="h-7 w-7 rounded-full bg-[var(--brand)] flex items-center justify-center flex-shrink-0 ring-2 ring-[var(--brand-light)]">
                                <span className="text-white text-xs font-bold">{userInitial}</span>
                            </div>
                        )}
                        <AnimatePresence>
                            {!collapsed && (
                                <motion.span
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -6 }}
                                    transition={{ duration: 0.18 }}
                                    className="text-xs font-medium text-[var(--text-secondary)] truncate whitespace-nowrap"
                                >
                                    {userName}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </motion.aside>
        </>
    );
}

function NavItem({ label, icon: Icon, active, collapsed, onClick, danger = false }) {
    return (
        <button
            onClick={onClick}
            title={collapsed ? label : undefined}
            className={cn(
                "relative flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                    ? "bg-[var(--brand-light)] text-[var(--brand)]"
                    : danger
                        ? "text-[var(--danger)] hover:bg-[var(--danger-light)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            )}
        >
            {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--brand)] rounded-r-full" />
            )}
            <Icon className={cn(
                "flex-shrink-0 w-[18px] h-[18px]",
                active ? "text-[var(--brand)]" : danger ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"
            )} />
            <AnimatePresence>
                {!collapsed && (
                    <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.18 }}
                        className="whitespace-nowrap overflow-hidden"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    );
}

export const Logo = ({ company, open }) => (
    <div className="flex items-center gap-2.5 px-3 py-2">
        {company?.logo
            ? <img src={company.logo} alt={company.name} className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
            : <div className="h-8 w-8 bg-[var(--brand)] rounded-lg flex-shrink-0" />}
        {open && <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{company?.name}</span>}
    </div>
);
