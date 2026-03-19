import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    BarChart3, Megaphone, Settings, Target,
    Building2, LogOut
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

/* ── Constants ──────────────────────────────────────────────── */
const W_COLLAPSED  = 56;   // px — icon-only strip
const W_EXPANDED   = 220;  // px — icons + labels
const OPEN_DELAY   = 100;  // ms before expanding (avoids accidental open)
const CLOSE_DELAY  = 300;  // ms before collapsing (avoids flicker when crossing icons)
const LABEL_DELAY  = 150;  // ms after sidebar starts expanding before labels fade in

/* ── Main Component ─────────────────────────────────────────── */
export function SidebarNew({ currentView, onNavigate, company }) {
    const [expanded, setExpanded]     = useState(false);
    const [showLabels, setShowLabels] = useState(false);
    const { signOut, user }           = useAuth();

    const openTimer   = useRef(null);
    const closeTimer  = useRef(null);
    const labelTimer  = useRef(null);

    // Cleanup on unmount
    useEffect(() => () => {
        clearTimeout(openTimer.current);
        clearTimeout(closeTimer.current);
        clearTimeout(labelTimer.current);
    }, []);

    const handleMouseEnter = useCallback(() => {
        clearTimeout(closeTimer.current);
        clearTimeout(labelTimer.current);
        openTimer.current = setTimeout(() => {
            setExpanded(true);
            // labels appear 150ms AFTER width animation begins (~200ms total)
            labelTimer.current = setTimeout(() => setShowLabels(true), LABEL_DELAY);
        }, OPEN_DELAY);
    }, []);

    const handleMouseLeave = useCallback(() => {
        clearTimeout(openTimer.current);
        clearTimeout(labelTimer.current);
        setShowLabels(false); // hide labels immediately on leave intent
        closeTimer.current = setTimeout(() => setExpanded(false), CLOSE_DELAY);
    }, []);

    if (!company) return null;

    const userName   = user?.user_metadata?.name || user?.name || "Usuário";
    const userPhoto  = user?.user_metadata?.photoUrl || user?.photoUrl;
    const userInitial = userName[0]?.toUpperCase() || "U";

    const companyInitials = company.name
        ?.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "ORG";

    const navItems = [
        { label: "Vendas",     view: "sales",     icon: BarChart3  },
        { label: "Marketing",  view: "marketing", icon: Megaphone  },
        { label: "Metas",      view: "set-goals", icon: Target     },
    ];

    const bottomItems = [
        { label: "Configurações", view: "settings", icon: Settings  },
        { label: "Trocar Empresa",view: "home",     icon: Building2 },
        { label: "Sair",          view: null,        icon: LogOut,   danger: true, onClick: signOut },
    ];

    return (
        <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                width: expanded ? W_EXPANDED : W_COLLAPSED,
                transition: `width 200ms ease-in-out`,
                willChange: "width",
            }}
            className={cn(
                "fixed left-0 top-0 h-[100dvh] z-50",
                "flex flex-col overflow-hidden",
                "bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]",
                "shadow-xl"
            )}
        >
            {/* ── Logo ───────────────────────────────────── */}
            <div className="flex items-center min-h-[60px] border-b border-[var(--border)] px-[14px] gap-3 overflow-hidden flex-shrink-0">
                {company.logo ? (
                    <img
                        src={company.logo}
                        alt={company.name}
                        className="h-7 w-7 rounded-lg object-cover flex-shrink-0"
                    />
                ) : (
                    <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-zinc-400 text-[10px] font-bold leading-none">
                            {companyInitials}
                        </span>
                    </div>
                )}

                <span
                    className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap truncate min-w-0"
                    style={{
                        opacity: showLabels ? 1 : 0,
                        transition: "opacity 150ms ease-in-out",
                        pointerEvents: "none",
                    }}
                >
                    {company.name}
                </span>
            </div>

            {/* ── Main Nav ───────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 flex flex-col gap-0.5">
                {navItems.map(({ label, view, icon: Icon }) => (
                    <NavItem
                        key={view}
                        label={label}
                        icon={Icon}
                        active={currentView === view}
                        showLabel={showLabels}
                        onClick={() => onNavigate(view)}
                    />
                ))}
            </nav>

            {/* ── Bottom Section ─────────────────────────── */}
            <div className="px-2 py-3 border-t border-[var(--border)] flex flex-col gap-0.5">
                {bottomItems.map(({ label, view, icon: Icon, danger, onClick }) => (
                    <NavItem
                        key={label}
                        label={label}
                        icon={Icon}
                        active={currentView === view}
                        showLabel={showLabels}
                        danger={danger}
                        onClick={onClick ?? (() => onNavigate(view))}
                    />
                ))}

                {/* ── User Avatar ────────────────────────── */}
                <button
                    onClick={() => onNavigate("profile")}
                    className="flex items-center gap-3 w-full mt-1 px-2 py-2 rounded-lg hover:bg-[var(--surface-raised)] transition-colors text-left overflow-hidden"
                >
                    {userPhoto ? (
                        <img
                            src={userPhoto}
                            alt={userName}
                            className="h-6 w-6 rounded-full object-cover flex-shrink-0 ring-2 ring-[var(--border)]"
                        />
                    ) : (
                        <div className="h-6 w-6 rounded-full bg-[var(--brand)] flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[10px] font-bold">{userInitial}</span>
                        </div>
                    )}
                    <span
                        className="text-xs font-medium text-[var(--text-secondary)] truncate whitespace-nowrap"
                        style={{
                            opacity: showLabels ? 1 : 0,
                            transition: "opacity 150ms ease-in-out",
                            pointerEvents: "none",
                        }}
                    >
                        {userName}
                    </span>
                </button>
            </div>
        </aside>
    );
}

/* ── NavItem ─────────────────────────────────────────────────── */
function NavItem({ label, icon: Icon, active, showLabel, onClick, danger = false }) {
    return (
        <div className="relative group/nav">
            <button
                onClick={onClick}
                className={cn(
                    "relative flex items-center gap-3 w-full px-2 py-2.5 rounded-lg text-sm font-medium",
                    "transition-colors duration-150 overflow-hidden",
                    active
                        ? "bg-[var(--surface-raised)] text-[var(--brand)]"
                        : danger
                            ? "text-[var(--danger)] hover:bg-[var(--danger-light)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                )}
            >
                {/* Active indicator */}
                {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--brand)] rounded-r-full" />
                )}

                {/* Icon */}
                <Icon
                    className={cn(
                        "flex-shrink-0 w-[18px] h-[18px]",
                        active
                            ? "text-[var(--brand)]"
                            : danger
                                ? "text-[var(--danger)]"
                                : "text-[var(--text-secondary)] group-hover/nav:text-[var(--text-primary)]"
                    )}
                />

                {/* Label — fades in after sidebar expands */}
                <span
                    className="whitespace-nowrap truncate"
                    style={{
                        opacity: showLabel ? 1 : 0,
                        transition: "opacity 150ms ease-in-out",
                        pointerEvents: "none",
                    }}
                >
                    {label}
                </span>
            </button>

            {/* Tooltip — only visible when collapsed (labels hidden) */}
            {!showLabel && (
                <div
                    className={cn(
                        "pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[9999]",
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap",
                        "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-lg",
                        "opacity-0 group-hover/nav:opacity-100",
                        "transition-opacity duration-150 delay-75"
                    )}
                >
                    {label}
                    {/* Arrow */}
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-800" />
                </div>
            )}
        </div>
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
