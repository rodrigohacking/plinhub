import React from 'react';
import {
    LayoutDashboard,
    BarChart3,
    ArrowLeftRight,
    Plus,
    Target,
    Building2,
    ChevronLeft,
    Megaphone,
    GitCompareArrows,
    Settings,
    Sun,
    Moon
} from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar({ currentView, onNavigate, company }) {
    const [isHovered, setIsHovered] = React.useState(false);

    const menuItems = [
        { id: 'sales', label: 'Dashboard Vendas', icon: BarChart3 },
        { id: 'marketing', label: 'Dashboard Marketing', icon: Megaphone },
        { id: 'settings', label: 'Configurações', icon: Settings }
    ];

    const actionItems = [
        { id: 'add-sale', label: 'Adicionar Venda', icon: Plus },
        { id: 'add-campaign', label: 'Adicionar Campanha', icon: Plus },
        { id: 'set-goals', label: 'Definir Metas', icon: Target },
    ];

    // Theme Logic
    const [isDark, setIsDark] = React.useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    React.useEffect(() => {
        const root = window.document.documentElement;
        // Strict enforcement of theme
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            console.log("Theme set to Dark");
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            console.log("Theme set to Light");
        }
    }, [isDark]);

    if (!company) return null;

    return (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "bg-white dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-white/5 h-screen flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-20 will-change-width",
                isHovered ? "w-64" : "w-20"
            )}
        >
            {/* Header / Back */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 overflow-hidden whitespace-nowrap shrink-0">
                <button
                    onClick={() => onNavigate('home')}
                    className={cn(
                        "flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-4 h-5",
                        !isHovered && "justify-center"
                    )}
                >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        isHovered ? "w-full opacity-100 ml-1 translate-x-0" : "w-0 opacity-0 ml-0 -translate-x-2"
                    )}>
                        Voltar
                    </div>
                </button>

                <div className="flex items-center gap-3 h-10">
                    <div className="min-w-10 h-10 rounded-lg bg-[#FD295E]/10 dark:bg-[#FD295E]/20 flex items-center justify-center text-[#FD295E] shrink-0">
                        {company.logo ? (
                            <img src={company.logo} alt={company.name} className="w-10 h-10 rounded-lg" />
                        ) : (
                            <Building2 className="w-6 h-6" />
                        )}
                    </div>
                    <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        isHovered ? "w-40 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-2"
                    )}>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Empresa Selecionada</div>
                        <div className="font-bold text-gray-900 dark:text-white truncate">{company.name}</div>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <div className="flex-1 py-6 px-3 space-y-6 overflow-x-hidden hover:overflow-y-auto scrollbar-hide">
                <div>

                    <div className="space-y-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={cn(
                                        "group relative w-full flex items-center px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden whitespace-nowrap",
                                        isActive
                                            ? "bg-[#FD295E]/10 text-[#FD295E]"
                                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5",
                                        !isHovered && "justify-center"
                                    )}
                                >
                                    {/* Active Indicator Strip */}
                                    {isActive && (
                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#FD295E] rounded-l-full" />
                                    )}

                                    <Icon className={cn("w-5 h-5 min-w-5 shrink-0 transition-colors", isActive ? "text-[#FD295E]" : "text-gray-400 group-hover:text-[#FD295E]")} />

                                    <span className={cn(
                                        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                                        isHovered ? "w-auto opacity-100 ml-3 translate-x-0" : "w-0 opacity-0 ml-0 -translate-x-4"
                                    )}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>

                    <div className="space-y-1">
                        {actionItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={cn(
                                        "group relative w-full flex items-center px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden whitespace-nowrap",
                                        isActive
                                            ? "bg-[#FD295E]/10 text-[#FD295E]"
                                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5",
                                        !isHovered && "justify-center"
                                    )}
                                >
                                    {/* Active Indicator Strip */}
                                    {isActive && (
                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#FD295E] rounded-l-full" />
                                    )}

                                    <Icon className={cn("w-5 h-5 min-w-5 shrink-0 transition-colors", isActive ? "text-[#FD295E]" : "text-gray-400 group-hover:text-[#FD295E]")} />

                                    <span className={cn(
                                        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                                        isHovered ? "w-auto opacity-100 ml-3 translate-x-0" : "w-0 opacity-0 ml-0 -translate-x-4"
                                    )}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Theme Toggle */}
            <div className={cn("pb-4 overflow-hidden shrink-0 transition-all duration-300", isHovered ? "px-4" : "px-2")}>
                <div className={cn(
                    "flex bg-gray-100 dark:bg-[#1a1a1a] p-1 rounded-xl border border-gray-200 dark:border-white/5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    !isHovered && "gap-1"
                )}>
                    <button
                        onClick={() => setIsDark(false)}
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                            !isHovered ? "w-full" : "flex-1",
                            !isDark
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        )}
                        title="Claro"
                    >
                        <Sun className="w-4 h-4 shrink-0" />
                        <span className={cn(
                            "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                            isHovered ? "w-auto opacity-100 ml-2" : "w-0 opacity-0 ml-0"
                        )}>
                            Claro
                        </span>
                    </button>
                    <button
                        onClick={() => setIsDark(true)}
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                            !isHovered ? "w-full" : "flex-1",
                            isDark
                                ? 'bg-[#FD295E] text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        )}
                        title="Escuro"
                    >
                        <Moon className="w-4 h-4 shrink-0" />
                        <span className={cn(
                            "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                            isHovered ? "w-auto opacity-100 ml-2" : "w-0 opacity-0 ml-0"
                        )}>
                            Escuro
                        </span>
                    </button>
                </div>
            </div>

            {/* Footer User Profile (Clickable) */}
            <div className="p-4 border-t border-gray-200 dark:border-white/5 dark:bg-[#0a0a0a] overflow-hidden whitespace-nowrap shrink-0">
                <button
                    onClick={() => onNavigate('profile')}
                    className={cn(
                        "w-full flex items-center p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group",
                        !isHovered ? "justify-center" : "gap-3"
                    )}
                >
                    <div className="w-8 h-8 min-w-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 dark:bg-white/10 dark:text-gray-300 group-hover:bg-[#FD295E] group-hover:text-white transition-colors shrink-0">
                        U
                    </div>
                    <div className={cn(
                        "text-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                        isHovered ? "w-40 opacity-100" : "w-0 opacity-0"
                    )}>
                        <div className="font-medium text-gray-900 dark:text-white">Usuário</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-[#FD295E] transition-colors">Editar Perfil</div>
                    </div>
                </button>
            </div>
        </aside>
    );
}
