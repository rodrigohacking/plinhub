import React, { useState, useEffect, useCallback } from 'react';
import { ImageOff, ExternalLink, RefreshCw, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveDateRange(dateRange) {
    const today = new Date();
    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const range = typeof dateRange === 'string' ? dateRange : (dateRange?.value || 'this-month');
    switch (range) {
        case 'today':         return { since: fmt(today), until: fmt(today) };
        case 'yesterday': {   const y = new Date(today); y.setDate(y.getDate() - 1); return { since: fmt(y), until: fmt(y) }; }
        case 'last-7-days': { const s = new Date(today); s.setDate(s.getDate() - 7);  return { since: fmt(s), until: fmt(today) }; }
        case 'last-30-days':{ const s = new Date(today); s.setDate(s.getDate() - 30); return { since: fmt(s), until: fmt(today) }; }
        case 'last-3-months':{ const s = new Date(today); s.setDate(s.getDate() - 90); return { since: fmt(s), until: fmt(today) }; }
        case 'last-month': {
            const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const last  = new Date(today.getFullYear(), today.getMonth(), 0);
            return { since: fmt(first), until: fmt(last) };
        }
        case 'this-year': {
            return { since: fmt(new Date(today.getFullYear(), 0, 1)), until: fmt(today) };
        }
        case 'all-time':      return { since: '2023-01-01', until: fmt(today) };
        default: {
            return { since: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), until: fmt(today) };
        }
    }
}

/** Formata valor monetário de forma compacta: R$766 ou R$1.2k */
function fmtMoney(value) {
    if (value == null) return '–';
    if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
    return `R$${value.toFixed(0)}`;
}

// ── Tooltip inline ────────────────────────────────────────────────────────────

function Tip({ text, children }) {
    const [visible, setVisible] = useState(false);
    return (
        <span
            className="relative cursor-default"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] leading-snug rounded-lg px-2.5 py-2 shadow-2xl z-50 pointer-events-none text-center whitespace-normal">
                    {text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
                </span>
            )}
        </span>
    );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden animate-pulse">
            <div className="aspect-video bg-zinc-800/60" />
            <div className="p-3 space-y-2">
                <div className="h-3 bg-zinc-800/60 rounded-full w-3/4" />
                <div className="h-7 bg-zinc-800/60 rounded-full w-2/5" />
                <div className="h-2.5 bg-zinc-800/60 rounded-full w-full" />
            </div>
        </div>
    );
}

// ── Individual creative card ──────────────────────────────────────────────────

function CreativeCard({ creative, sortBy, isTop2, cplTarget }) {
    const [imgError, setImgError] = useState(false);

    // ── Borda esquerda baseada em CPL vs meta ────────────────────────────────
    let leftBorder = 'border-l-[var(--border)]';
    if (cplTarget > 0 && creative.cpl != null) {
        leftBorder = creative.cpl <= cplTarget ? 'border-l-emerald-500' : 'border-l-red-500';
    }

    // ── Métrica principal (depende do toggle ativo) ──────────────────────────
    let primaryNode, primaryColor;
    if (sortBy === 'leads') {
        primaryColor = creative.leads > 0 ? 'text-emerald-400' : 'text-red-500';
        primaryNode = (
            <span className={cn('text-[22px] font-bold leading-tight', primaryColor)}>
                {creative.leads}
                <span className="text-sm font-medium ml-1 text-zinc-400">leads</span>
            </span>
        );
    } else if (sortBy === 'spend') {
        primaryColor = 'text-[var(--text-primary)]';
        primaryNode = (
            <span className="text-[22px] font-bold leading-tight text-[var(--text-primary)]">
                {formatCurrency(creative.spend)}
            </span>
        );
    } else {
        primaryColor = 'text-[var(--text-primary)]';
        primaryNode = (
            <span className="text-[22px] font-bold leading-tight text-[var(--text-primary)]">
                {creative.ctr.toFixed(1)}%
            </span>
        );
    }

    // ── Métricas secundárias (as 3 que não são a principal) ──────────────────
    const dot = <span className="mx-1 text-zinc-700" aria-hidden>·</span>;
    let secondaryItems = [];
    if (sortBy !== 'spend') secondaryItems.push(
        <Tip key="inv" text="Total gasto nesse criativo no período">{fmtMoney(creative.spend)}</Tip>
    );
    if (sortBy !== 'leads') secondaryItems.push(
        <Tip key="leads" text="Total de leads gerados por esse criativo">{creative.leads} leads</Tip>
    );
    if (sortBy !== 'ctr') secondaryItems.push(
        <Tip key="ctr" text="Taxa de Clique: % de pessoas que clicaram no anúncio">CTR {creative.ctr.toFixed(1)}%</Tip>
    );
    secondaryItems.push(
        <Tip key="cpl" text="Custo por Lead: quanto você pagou por cada lead gerado">
            CPL {fmtMoney(creative.cpl)}
        </Tip>
    );
    const secondary = secondaryItems.reduce((acc, el, i) => {
        if (i > 0) acc.push(<span key={`d${i}`} className="mx-1 text-zinc-700">·</span>);
        acc.push(el);
        return acc;
    }, []);

    return (
        <div className={cn(
            'group relative bg-[var(--surface)] rounded-xl border border-[var(--border)] border-l-2 overflow-hidden',
            'transition-all duration-200 hover:border-zinc-600 hover:-translate-y-0.5 hover:shadow-xl',
            leftBorder
        )}>
            {/* ── Thumbnail 16:9 ── */}
            <div className="aspect-video bg-zinc-900 overflow-hidden relative">
                {!imgError && creative.thumbnail_url ? (
                    <img
                        src={creative.thumbnail_url}
                        alt={creative.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        onError={() => setImgError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900">
                        <ImageOff className="w-6 h-6 text-zinc-700" />
                        <span className="text-[9px] font-medium text-center px-3 leading-tight text-zinc-600 line-clamp-2">
                            {creative.name}
                        </span>
                    </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <a
                        href={`https://www.facebook.com/ads/manager/account/campaigns?act=${creative.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white text-xs font-semibold hover:bg-white/20 transition-colors"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Ver no Meta Ads →
                    </a>
                </div>

                {/* Badge DESTAQUE — só top 2, canto superior esquerdo */}
                {isTop2 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                        <TrendingUp className="w-2.5 h-2.5 text-white" />
                        <span className="text-[8px] font-bold text-white uppercase tracking-wide">Destaque</span>
                    </div>
                )}
            </div>

            {/* ── Info ── */}
            <div className="p-3">
                {/* Linha 1: nome */}
                <p className="text-sm font-semibold text-zinc-100 truncate mb-1 leading-snug">
                    {creative.name}
                </p>

                {/* Linha 2: métrica principal */}
                <div className="mb-1">{primaryNode}</div>

                {/* Linha 3: métricas secundárias com tooltip */}
                <p className="text-[11px] text-zinc-500 flex flex-wrap items-center leading-normal">
                    {secondary}
                </p>
            </div>
        </div>
    );
}

// ── Main Gallery ──────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
    { key: 'leads', label: 'Leads'        },
    { key: 'spend', label: 'Investimento' },
    { key: 'ctr',   label: 'CTR'          },
];

/** criativo "sem resultado relevante" = 0 leads E investimento < R$50 */
const isIrrelevant = (c) => c.leads === 0 && c.spend < 50;

export function CreativeGallery({ companyId, dateRange, cplTarget = 0 }) {
    const [creatives,       setCreatives]       = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [error,           setError]           = useState(null);
    const [sortBy,          setSortBy]          = useState('leads');
    const [fetchedAt,       setFetchedAt]       = useState(null);
    const [refreshing,      setRefreshing]      = useState(false);
    const [showIrrelevant,  setShowIrrelevant]  = useState(false);

    const fetchCreatives = useCallback(async (bust = false) => {
        if (!companyId) return;
        bust ? setRefreshing(true) : setLoading(true);
        setError(null);

        try {
            const { since, until } = deriveDateRange(dateRange);
            const params = new URLSearchParams({ companyId, since, until });
            if (bust) params.set('bust', '1');

            const res = await fetch(`/api/meta/creatives?${params}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            const json = await res.json();
            setCreatives(json.creatives || []);
            setFetchedAt(json.fetched_at || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [companyId, dateRange]);

    useEffect(() => { fetchCreatives(); }, [fetchCreatives]);

    // ── Separar relevantes / irrelevantes e ordenar ───────────────────────────
    const sortFn = (a, b) => {
        if (sortBy === 'leads') return b.leads - a.leads;
        if (sortBy === 'spend') return b.spend - a.spend;
        if (sortBy === 'ctr')   return b.ctr   - a.ctr;
        return 0;
    };

    const relevant   = creatives.filter(c => !isIrrelevant(c)).sort(sortFn);
    const irrelevant = creatives.filter(c =>  isIrrelevant(c)).sort(sortFn);

    // Top 2 IDs por leads para o badge DESTAQUE
    const top2Ids = new Set(
        [...creatives].sort((a, b) => b.leads - a.leads).slice(0, 2).map(c => c.id)
    );

    return (
        <div className="space-y-4">
            {/* ── Header bar ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 bg-[var(--surface-raised)] rounded-xl p-1">
                    {SORT_OPTIONS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setSortBy(key)}
                            className={cn(
                                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                                sortBy === key
                                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {fetchedAt && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                            Atualizado {new Date(fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchCreatives(true)}
                        disabled={refreshing || loading}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors disabled:opacity-40"
                        title="Atualizar criativos"
                    >
                        <RefreshCw className={cn('w-3.5 h-3.5', (refreshing || loading) && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {/* ── Content ───────────────────────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 bg-[var(--surface-raised)] rounded-2xl gap-3">
                    <ImageOff className="w-10 h-10 text-zinc-700" />
                    <p className="text-sm text-[var(--text-muted)] font-medium text-center max-w-xs">
                        {error.includes('not configured')
                            ? 'Integração Meta Ads não configurada para esta empresa.'
                            : `Erro ao buscar criativos: ${error}`}
                    </p>
                </div>
            ) : creatives.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-[var(--surface-raised)] rounded-2xl gap-3">
                    <ImageOff className="w-10 h-10 text-zinc-700" />
                    <p className="text-sm text-[var(--text-muted)] font-medium">
                        Nenhum criativo com dados no período selecionado
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Criativos relevantes */}
                    {relevant.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {relevant.map(c => (
                                <CreativeCard
                                    key={c.id}
                                    creative={c}
                                    sortBy={sortBy}
                                    isTop2={top2Ids.has(c.id)}
                                    cplTarget={cplTarget}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[var(--text-muted)] text-center py-6">
                            Nenhum criativo com resultado relevante no período
                        </p>
                    )}

                    {/* Seção colapsada: sem conversão */}
                    {irrelevant.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowIrrelevant(v => !v)}
                                className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors py-1"
                            >
                                {showIrrelevant
                                    ? <ChevronUp className="w-3 h-3" />
                                    : <ChevronDown className="w-3 h-3" />}
                                {showIrrelevant
                                    ? 'Ocultar criativos sem conversão'
                                    : `Ver criativos sem conversão (${irrelevant.length})`}
                            </button>

                            {showIrrelevant && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 opacity-60">
                                    {irrelevant.map(c => (
                                        <CreativeCard
                                            key={c.id}
                                            creative={c}
                                            sortBy={sortBy}
                                            isTop2={false}
                                            cplTarget={cplTarget}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
