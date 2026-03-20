import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend, Cell, PieChart, Pie
} from 'recharts';
import { DollarSign, UserPlus, Target, MousePointer, TrendingUp, TrendingDown, Minus, Filter, Instagram, Globe, Search, Users, Ban, CircleDollarSign, PieChart as PieChartIcon, Leaf, RefreshCw, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { CreativeGallery } from './marketing/CreativeGallery';
import { KPICard } from './KPICard';
import { GoalProgress } from './GoalProgress';
import { formatCurrency, formatNumber, formatPercent, cn } from '../lib/utils';
import { DateRangeFilter, filterByDateRange, isDateInSelectedRange } from './DateRangeFilter';
import { TOOLTIP_STYLE, GRID_PROPS, AXIS_TICK, AXIS_SHARED } from '../lib/chartTheme';

export function DashboardMarketing({ company, data, onRefresh, dateRange, setDateRange }) {
    // dateRange comes from App.jsx (global persistence)
    const [activeTab, setActiveTab] = useState('geral');
    const [creativesTab, setCreativesTab] = useState('creatives'); // 'creatives' or 'campaigns'
    const [isSyncing, setIsSyncing] = useState(false);
    const [showExtraCards, setShowExtraCards] = useState(() => {
        try { return JSON.parse(localStorage.getItem('plin_mkt_extraCards') || 'false'); } catch { return false; }
    });
    const [showDetails, setShowDetails] = useState(() => {
        try { return JSON.parse(localStorage.getItem('plin_mkt_showDetails') || 'false'); } catch { return false; }
    });

    // Effective campaigns — sourced exclusively from Supabase DB (via data.campaigns)
    const effectiveCampaigns = useMemo(() => {
        return (data.campaigns || []).filter(c => String(c.companyId || c.company_id) === String(company.id));
    }, [data.campaigns, company.id]);

    const handleSync = async () => {
        setIsSyncing(true);
        const toastId = toast.loading('Sincronizando Meta Ads + Pipefy...');

        try {
            // Sync both Meta Ads and Pipefy in parallel
            const [metaRes, pipefyRes] = await Promise.allSettled([
                fetch(`/api/sync/${company.id}/meta?days=30`, { method: 'POST' })
                    .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || r.status); })),
                fetch(`/api/sync/${company.id}/pipefy`, { method: 'POST' })
                    .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || r.status); }))
            ]);

            const metaRows = metaRes.status === 'fulfilled' ? metaRes.value.rowsUpserted : 0;
            const pipefyRows = pipefyRes.status === 'fulfilled' ? pipefyRes.value.rowsUpserted : 0;

            if (metaRes.status === 'rejected') console.warn('[Sync] Meta Ads failed:', metaRes.reason);
            if (pipefyRes.status === 'rejected') console.warn('[Sync] Pipefy failed:', pipefyRes.reason);

            const parts = [];
            if (metaRows > 0) parts.push(`${metaRows} campanhas Meta`);
            if (pipefyRows > 0) parts.push(`${pipefyRows} deals Pipefy`);

            toast.success(
                parts.length > 0
                    ? `Dados atualizados: ${parts.join(', ')}`
                    : 'Sync concluído (sem novos dados)',
                { id: toastId }
            );

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error(error);
            toast.error(`Erro ao sincronizar: ${error.message}`, { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    // Helper to get actual start/end dates from range string
    const getDateRangeValues = (range, customStart = null, customEnd = null) => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);

        const fmt = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        switch (range) {
            case 'today':
                return { since: fmt(today), until: fmt(today) };
            case 'yesterday': {
                const yest = new Date(today);
                yest.setDate(yest.getDate() - 1);
                return { since: fmt(yest), until: fmt(yest) };
            }
            case 'last-7-days':
                startDate.setDate(today.getDate() - 7);
                return { since: fmt(startDate), until: fmt(endDate) };
            case 'last-30-days':
                startDate.setDate(today.getDate() - 30);
                return { since: fmt(startDate), until: fmt(endDate) };
            case 'this-month': {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                return { since: fmt(firstDay), until: fmt(endDate) };
            }
            case 'last-month': {
                const firstDayLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastDayLast = new Date(today.getFullYear(), today.getMonth(), 0);
                return { since: fmt(firstDayLast), until: fmt(lastDayLast) };
            }
            case 'last-3-months':
                startDate.setDate(today.getDate() - 90);
                return { since: fmt(startDate), until: fmt(endDate) };
            case 'this-year': {
                const firstDayYear = new Date(today.getFullYear(), 0, 1);
                return { since: fmt(firstDayYear), until: fmt(endDate) };
            }
            case 'all-time':
                startDate.setFullYear(2023, 0, 1);
                return { since: fmt(startDate), until: fmt(endDate) };
            default:
                if (range && range.startsWith('custom:') && customStart && customEnd) {
                    return { since: customStart, until: customEnd };
                }
                startDate.setDate(today.getDate() - 30);
                return { since: fmt(startDate), until: fmt(endDate) };
        }
    };

    // AUTO-SYNC ON MOUNT
    // Runs once per company mount. Syncs both Meta campaigns AND Pipefy deals (sales table).
    const syncRan = React.useRef(false);

    React.useEffect(() => {
        let isMounted = true;
        syncRan.current = false; // reset when company changes

        const autoSync = async () => {
            if (!company?.id) return;
            if (syncRan.current) return;
            syncRan.current = true;

            setIsSyncing(true);
            try {
                await Promise.allSettled([
                    fetch(`/api/sync/${company.id}/meta?days=90`, { method: 'POST' }),
                    fetch(`/api/sync/${company.id}/pipefy`, { method: 'POST' })
                ]);
                if (isMounted && onRefresh) onRefresh();
            } catch (e) {
                console.warn('Auto-Sync error:', e);
            } finally {
                if (isMounted) setIsSyncing(false);
            }
        };

        const timeout = setTimeout(autoSync, 500);
        return () => {
            isMounted = false;
            clearTimeout(timeout);
        };
    }, [company.id]);

    // Determine if company sells insurance products
    const isAndar = company?.name?.toLowerCase().includes('andar');
    const isApolar = company?.name?.toLowerCase().includes('apolar');
    const isInsuranceCompany = isAndar || isApolar;

    // Terminologia contextual: Apolar usa 'Contratos', demais usam 'Apólices'
    const labelVolume = isApolar ? 'Volume em Contratos' : 'Volume em Apólices';
    const labelVenda  = isApolar ? 'contrato' : 'venda';
    const labelVendas = isApolar ? 'contratos' : 'vendas';

    // Tabs Configuration - conditional based on company type
    // Product Definitions (Master List for Auto-Detection)
    // Keywords cover all real naming patterns used in Meta Ads campaigns
    const PRODUCT_DEFINITIONS = [
        {
            id: 'condominial',
            label: 'Condominial',
            keywords: ['condominial', 'condominio', 'condomínio', 'cond ', 'cond.', 'predio', 'prédio', 'sindical']
        },
        {
            id: 'rc_sindico',
            label: 'RC Síndico',
            keywords: ['rc sindico', 'rc síndico', 'rc-sindico', 'rcsindico', 'rc_sindico',
                       'sindico', 'síndico', 'r.c.', 'responsabilidade civil']
        },
        {
            id: 'automovel',
            label: 'Automóvel',
            keywords: ['auto', 'automovel', 'automóvel', 'carro', 'veiculo', 'veículo', 'frota']
        },
        {
            id: 'residencial',
            label: 'Residencial',
            keywords: ['residencial', 'casa', 'habitacional', 'apartamento', 'apto']
        },
        {
            id: 'administradora',
            label: 'Administradora',
            keywords: ['administradora', 'gestao', 'gestão', 'adm ']
        },
        {
            id: 'vida',
            label: 'Vida',
            keywords: ['vida', 'seguro vida', 'seg vida']
        },
        {
            id: 'empresarial',
            label: 'Empresarial',
            keywords: ['empresa', 'empresarial', 'pme', 'comercial', 'negocio', 'negócio']
        }
    ];

    // Helper: Normalize Text for Matching (remove accents, lowercase)
    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

    /**
     * extractProductFromCampaignName
     * 
     * Parses structured campaign names used by Andar Seguros:
     *   [ANDAR] [VIDEOS] [3.0] 07/11 CONDOMINIAL
     *   [ANDAR] [IMG IA] [3.0] 12/02 RC SÍNDICO
     * 
     * Strategy:
     *  1. Remove all bracket sections [...]
     *  2. Remove the leading DD/MM date pattern
     *  3. Return the remaining text as the product suffix
     * 
     * @param {string} name - Campaign name
     * @returns {string} Normalized product suffix (e.g. "condominial", "rc sindico")
     */
    const extractProductFromCampaignName = (name) => {
        if (!name) return '';
        // Remove bracket tags: [ANDAR], [VIDEOS], [3.0], etc.
        let clean = name.replace(/\[[^\]]*\]/g, '');
        // Remove date pattern: 07/11, 12/02, etc.
        clean = clean.replace(/\b\d{1,2}\/\d{1,2}\b/g, '');
        // Remove extra whitespace
        clean = clean.replace(/\s+/g, ' ').trim();
        return normalize(clean);
    };

    // Dynamic Product Detection based on Keywords in Campaign Names
    const detectedProducts = useMemo(() => {
        const found = new Set();

        effectiveCampaigns.forEach(c => {
            const normalName = normalize(c.name || '');
            const productSuffix = extractProductFromCampaignName(c.name || '');

            PRODUCT_DEFINITIONS.forEach(prod => {
                const allKeywords = prod.keywords.map(kw => normalize(kw));
                // Check both full name and extracted product suffix for best match
                const matchesFull = allKeywords.some(kw => normalName.includes(kw));
                const matchesSuffix = allKeywords.some(kw => productSuffix.includes(kw));
                if (matchesFull || matchesSuffix) found.add(prod.id);
            });
        });

        return Array.from(found);
    }, [effectiveCampaigns]);

    // Tabs Configuration - Dynamic based on active products
    const TABS = useMemo(() => {
        const base = [{ id: 'geral', label: 'Geral', color: 'blue' }];
        const colors = ['indigo', 'purple', 'rose', 'emerald', 'amber', 'cyan', 'pink', 'orange', 'violet', 'teal'];
        
        detectedProducts.forEach((prodId, index) => {
            const def = PRODUCT_DEFINITIONS.find(d => d.id === prodId);
            if (def) {
                base.push({
                    id: def.id,
                    label: def.label,
                    color: colors[index % colors.length]
                });
            }
        });

        return base;
    }, [detectedProducts]);

    // Calculation Engine
    const metrics = useMemo(() => {
        // Map dynamic products to their keywords
        const productMapping = {};
        PRODUCT_DEFINITIONS.forEach(prod => {
            productMapping[prod.id] = { 
                dbLabel: prod.id, 
                keywords: prod.keywords.map(kw => normalize(kw))
            };
        });

        const activeScope = productMapping[activeTab];

        let targetSum = { investment: 0, sales: 0, leads: 0, revenue: 0 };
        let weightedCplSum = 0; // To calculate average CPL target

        // 2. Fetch Targets (Metas)
        if (activeTab === 'geral') {
            // For insurance companies: Sum of specific 4 products
            // For non-insurance companies: Use 'all' label directly
            // Sum per product label (insurance products)
            const products = Array.from(new Set([...detectedProducts, 'condominial', 'rc_sindico', 'automovel', 'residencial']));

            products.forEach(pKey => {
                const pConfig = productMapping[pKey];
                if (!pConfig) return;

                // Find latest manual goal for this product (source='manual' excludes live Meta Ads data)
                const row = (data.metrics || [])
                    .filter(m => String(m.companyId || m.company_id) === String(company.id) && m.label === pConfig.dbLabel && m.source === 'manual')
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .pop() || {};

                targetSum.investment += (row.spend || 0);
                targetSum.sales += (row.cardsConverted || 0);

                const pInvest = row.spend || 0;
                const pCpc = row.cpc || 0;
                const pLeads = (pInvest && pCpc) ? Math.round(pInvest / pCpc) : (row.cardsCreated || 0);
                targetSum.leads += pLeads;
            });

            // Fallback: if no product-specific goals found, try 'all' label (non-insurance companies)
            if (targetSum.investment === 0) {
                const row = (data.metrics || [])
                    .filter(m => String(m.companyId || m.company_id) === String(company.id) && m.label === 'all' && m.source === 'manual')
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .pop() || {};

                targetSum.investment = row.spend || 0;
                if (!targetSum.sales) targetSum.sales = row.cardsConverted || 0;
                const pCpc = row.cpc || 0;
                if (!targetSum.leads) targetSum.leads = (targetSum.investment && pCpc) ? Math.round(targetSum.investment / pCpc) : (row.cardsCreated || 0);
                weightedCplSum = pCpc;
            }

            // Average Target CPL (Weighted)
            weightedCplSum = targetSum.leads > 0 ? targetSum.investment / targetSum.leads : weightedCplSum;

            // OVERRIDE: Prioritize Explicit Sales Goals (from Forms/Supabase) for 'geral'
            // Fallback: if no current-month goal, use the most recent saved goal
            if (activeTab === 'geral' && data.goals) {
                const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
                const companyGoals = (data.goals || []).filter(g => String(g.companyId || g.company_id) === String(company.id));
                const salesGoal = companyGoals.find(g => g.month === currentMonth)
                    || companyGoals.sort((a, b) => (b.month || '').localeCompare(a.month || '')).at(0);

                if (salesGoal) {
                    if (salesGoal.deals) targetSum.sales = salesGoal.deals;
                    if (salesGoal.leads) targetSum.leads = salesGoal.leads;
                    if (salesGoal.revenue) targetSum.revenue = salesGoal.revenue;
                    if (salesGoal.investment) targetSum.investment = salesGoal.investment;
                    if (salesGoal.cpl || salesGoal.roi) weightedCplSum = salesGoal.cpl || salesGoal.roi;
                }
            }

            // localStorage fast-path: overrides DB values for instant display after saving goals
            try {
                const lsGoals = JSON.parse(localStorage.getItem(`plin_mkt_goals_${company.id}`) || '{}');
                if (lsGoals.investment) targetSum.investment = lsGoals.investment;
                if (lsGoals.cpl) weightedCplSum = lsGoals.cpl;
                if (lsGoals.leads && !targetSum.leads) targetSum.leads = lsGoals.leads;
            } catch (_) {}

        } else {
            // Specific Product — only manual/goal metrics (source='manual'), not live Meta Ads data
            const row = (data.metrics || [])
                .filter(m => String(m.companyId || m.company_id) === String(company.id) && m.label === activeScope?.dbLabel && m.source === 'manual')
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .pop() || {};

            targetSum.investment = row.spend || 0;
            targetSum.sales = row.cardsConverted || 0;
            const pCpc = row.cpc || 0;
            targetSum.leads = (targetSum.investment && pCpc) ? Math.round(targetSum.investment / pCpc) : (row.cardsCreated || 0);
            weightedCplSum = pCpc;
        }

        const targets = {
            investment: targetSum.investment,
            cpl: weightedCplSum,
            leads: targetSum.leads,
            sales: targetSum.sales,
            revenue: targetSum.revenue || 0
        };

        // 3. Calculate Realized (Actuals)
        // A. Pipefy Data (Leads & Sales)
        const companySales = data.sales.filter(s => String(s.companyId || s.company_id) === String(company.id));
        const filteredByDate = filterByDateRange(companySales, dateRange, 'createdAt'); // for Leads
        const filteredByDateClosed = filterByDateRange(companySales, dateRange, 'date'); // for Sales

        // Product Filter Logic
        // Priority: insuranceType/product field → utm_campaign name → utm_content
        const filterByProduct = (deals) => {
            if (activeTab === 'geral') return deals;

            const scope = productMapping[activeTab];
            if (!scope) return deals;

            const keywords = (scope.keywords || []).map(kw => normalize(kw));

            return deals.filter(d => {
                // 1. Check insuranceType or product field (most reliable)
                const typeField = normalize(d.insuranceType || d.product || '');
                if (typeField && keywords.some(kw => typeField.includes(kw))) return true;

                // 2. Fallback: check utm_campaign (campaign name from Meta Ads)
                //    Strips structured parts [ANDAR] [FORMAT] [VER] DD/MM and checks product suffix
                const utmCampaign = d.utm_campaign || d.utmCampaign || '';
                if (utmCampaign) {
                    const normalFull = normalize(utmCampaign);
                    // Extract product suffix from structured name
                    let cleanUtm = utmCampaign.replace(/\[[^\]]*\]/g, '').replace(/\b\d{1,2}\/\d{1,2}\b/g, '');
                    const normalSuffix = normalize(cleanUtm.replace(/\s+/g, ' ').trim());
                    if (keywords.some(kw => normalFull.includes(kw) || normalSuffix.includes(kw))) return true;
                }

                // 3. Fallback: check utm_content
                const utmContent = normalize(d.utm_content || d.utmContent || '');
                if (utmContent && keywords.some(kw => utmContent.includes(kw))) return true;

                return false;
            });
        };


        // META ADS Filter Logic - Apply to ALL tabs (Aggregated Definition)
        const filterByMetaAds = (deals) => {
            return deals.filter(d => {
                const hasMetaTag = d.labels?.some(label =>
                    label?.toUpperCase().includes('META ADS') ||
                    label?.toUpperCase() === 'META ADS'
                );

                // Robust Check: Also check UTMs if label is missing
                const hasUtmMeta = [d.utm_source, d.utm_medium, d.utm_campaign].some(val => {
                    const v = (val || '').toLowerCase();
                    return v.includes('meta') || v.includes('facebook') || v.includes('instagram');
                });

                return hasMetaTag || hasUtmMeta;
            });
        };

        // Apply both product and META ADS filters
        // DATA PROCESSING: The API returns Daily Aggregates (Metric Rows), NOT individual deals!
        // We must SUM the values, not count the rows.

        // 1. Filter Metrics by Date Range
        // Use the imported helper which handles 'this-month', 'last-7-days' strings strings correctly
        const metricsInRange = filterByDateRange(data.metrics || [], dateRange, 'date');

        // 2. Filter by Meta Ads Label (User Request: "tag do meta")
        const metaMetrics = metricsInRange.filter(m =>
            (m.label === 'META ADS') ||
            (m.label === 'Meta Ads')
        );

        // 4. Filter Campaigns by Active Tab (Scope)
        const activeScopeResolved = activeTab === 'geral' ? null : productMapping[activeTab];

        // 3. Sum Totals


        // Re-populate wonDeals (List) using the EXACT SAME LOGIC as the "Vendas" Card
        // A. Filter Won Deals by 'won_date' (real policy closing date) if available
        const wonDealsRaw = (data.sales || []).filter(s => {
            const isCurrentCompany = String(s.companyId || s.company_id) === String(company.id);
            const pName = (s.phaseName || '').toLowerCase();
            const normP = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const normPhase = normP(pName);

            const isWon = (
                normPhase.includes('ganho') || 
                normPhase.includes('fechado') || 
                normPhase.includes('fechada') ||
                normPhase.includes('enviado ao cliente') || 
                normPhase.includes('apolice fechada') ||
                normPhase.includes('fechamento - ganho') ||
                s.status === 'won'
            );

            // Use won_date (snake_case) if exists, fallback to date
            const effectiveDate = s.won_date ? new Date(s.won_date) : 
                               (s.wonDate ? new Date(s.wonDate) : new Date(s.date));
            const inRange = isDateInSelectedRange(effectiveDate, dateRange);

            // Filter by Meta Ads tag for Marketing Dashboard ROI accuracy
            const hasMeta = s.labels?.some(l => {
                const labelName = normalize(typeof l === 'string' ? l : (l?.name || ''));
                return labelName.includes('meta ads');
            });

            return isCurrentCompany && isWon && inRange && hasMeta;
        });

        // Apply product filter to won deals based on active tab
        const wonDeals = filterByProduct(wonDealsRaw);

        // 4. Final Calculation (PURELY FROM LIST - BYPASSING AGGREGATES)
        // User Request: "Leads Gerados (tag meta) - Perdidos = Leads Qualificados"
        // We use COHORT LOGIC: Count leads CREATED in the period, and check IF they are lost.
        // This ensures consistent data (Created 20 - Lost 5 = Qualified 15).

        // A. Leads Created (Meta) — filtered by company, date range, Meta tag and product
        const leadsListRaw = (data.sales || []).filter(s => {
            // Must be from this company
            if (String(s.companyId || s.company_id) !== String(company.id)) return false;

            // Flexible Meta Check (Labels)
            const hasMeta = s.labels?.some(l => {
                if (!l) return false;
                const labelText = (typeof l === 'string' ? l : l.name || '').toLowerCase();
                return labelText.includes('meta') || labelText.includes('facebook') || labelText.includes('ig ') || labelText.includes('instagram');
            });

            // Use createdAt for "Leads Generated"
            const effectiveDate = s.createdAt || s.created_at || s.date;
            const inRange = isDateInSelectedRange(effectiveDate, dateRange);
            return hasMeta && inRange;
        });

        // Apply product filter to leads (so Condominial tab only shows Condominial leads)
        const leadsList = filterByProduct(leadsListRaw);


        // B. Leads Lost (Meta - Subset of Created)
        // User Request: Strict adherence to "Perdido" status for these leads.
        const lostList = leadsList.filter(s => {
            const pName = (s.phaseName || s.phase_name || '').toLowerCase();
            const normalizeStr = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const normPhase = normalizeStr(pName);

            // Strict Status Check (Phase ID or Name)
            // IDs: 338889931 (Andar Lose)
            const isLost = s.status === 'lost' ||
                ['338889931'].includes(String(s.phaseId || s.phase_id)) ||
                normPhase.includes('perdido') ||
                normPhase.includes('cancelado') ||
                normPhase.includes('descarte') ||
                normPhase.includes('recusado') ||
                normPhase.includes('invalido');

            return isLost;
        });

        const totalCreated = leadsList.length; // Use List Count
        const totalLost = lostList.length;     // Use List Count
        const leadsRealized = totalCreated;

        const salesRealized = wonDeals.length;
        const salesVolume = wonDeals.reduce((acc, d) => acc + d.amount, 0);





        // B. Investment Realized (Meta Ads) - Strict Filtering
        let investmentRealized = 0;
        let adsLeads = 0;
        let impressions = 0;
        let clicks = 0;

        // NEW STRATEGY: Campaign-Based Calculation (Lifetime / Live Data)
        // User requested to calculate Investment iterating over 'effectiveCampaigns' (which contains dailyInsights)
        // instead of 'data.metrics' (Metric table). This avoids DB Sync gaps and allows Name-based filtering.

        // NEW STRATEGY: Iterate effectiveCampaigns (merged DB + Live)
        const relevantCampaigns = effectiveCampaigns.filter(c => String(c.companyId || c.company_id) === String(company.id));
        console.log(`[DashboardMarketing] ${company.name} - Relevant Campaigns:`, relevantCampaigns.length, relevantCampaigns);

        relevantCampaigns.forEach(campaign => {
            // 1. Check Product Scope
            let isProductMatch = false;
            const cName = normalize(campaign.name || '');
            // Extract the product suffix from structured name: [ANDAR] [FORMAT] [VER] DD/MM PRODUTO
            const cSuffix = (() => {
                let clean = (campaign.name || '').replace(/\[[^\]]*\]/g, ''); // remove [...]
                clean = clean.replace(/\b\d{1,2}\/\d{1,2}\b/g, '');           // remove DD/MM
                return normalize(clean.replace(/\s+/g, ' ').trim());
            })();

            if (activeTab === 'geral') {
                isProductMatch = true;
            } else if (activeScopeResolved) {
                const keywords = activeScopeResolved.keywords.map(kw => normalize(kw));
                // Match against full name OR extracted product suffix
                isProductMatch = keywords.some(kw => cName.includes(kw) || cSuffix.includes(kw));
            }

            if (isProductMatch) {
                // If the campaign brings dailyInsights from the Backend Proxy, we filter exactly by the selected dates
                if (campaign.dailyInsights && Array.isArray(campaign.dailyInsights) && campaign.dailyInsights.length > 0) {
                    campaign.dailyInsights.forEach(day => {
                        if (isDateInSelectedRange(day.date, dateRange)) {
                            investmentRealized += parseFloat(day.spend || 0);
                            impressions += parseInt(day.impressions || 0, 10);
                            clicks += parseInt(day.clicks || 0, 10);
                            adsLeads += parseInt(day.leads || 0, 10);
                        }
                    });
                } else {
                    // Fallback for cached DB campaigns (Lifetime)
                    investmentRealized += parseFloat(campaign.investment || campaign.spend || 0);
                    impressions += parseFloat(campaign.impressions || 0);
                    clicks += parseFloat(campaign.clicks || 0);
                    adsLeads += parseFloat(campaign.leads || 0);
                }
            }
        });

        // 4. KPIs
        // CPL Realized: Use Ads Leads if > 0, otherwise fallback to Pipefy Leads (safety) but prompt requested Ads Data.
        // If we have 0 ads leads, prevent Infinity.
        const effectiveLeads = adsLeads; // User Request: "leads do proprio meta" (Sync with Meta)

        // Correct Calculation: Displayed Leads (Meta) - Displayed Lost (Pipefy)
        const qualifiedRealized = Math.max(0, effectiveLeads - totalLost);


        // DEBUG LOGGING (Moved here to have access to final vars)
        console.log(`[KPI DEBUG] Calculation (${dateRange.label}):`);
        console.log(`- Meta Effective Leads: ${effectiveLeads}`);
        console.log(`- Pipefy Lost: ${totalLost}`);
        console.log(`- Qualified: ${qualifiedRealized}`);


        const cplRealized = effectiveLeads > 0 ? investmentRealized / effectiveLeads : 0;

        // ROI: (Volume Vendas - Investimento) / Investimento
        let roi = investmentRealized > 0 ? ((salesVolume - investmentRealized) / investmentRealized) * 100 : 0;
        let roiMultiplier = investmentRealized > 0 ? (salesVolume / investmentRealized) : 0;

        // Percentages
        const investmentPrc = targets.investment ? (investmentRealized / targets.investment) * 100 : 0;
        const cplPrc = targets.cpl ? (cplRealized / targets.cpl) * 100 : 0;

        // Conversion Rate: Sales / Leads * 100
        const conversionRate = effectiveLeads > 0 ? (salesRealized / effectiveLeads) * 100 : 0;

        return {
            targets,
            realized: {
                investment: investmentRealized,
                leads: effectiveLeads, // Using Pipefy List count
                qualified: qualifiedRealized,
                lost: totalLost, // Consistent Robust Calculation
                sales: salesRealized,
                cpl: cplRealized,
                volume: salesVolume,
                cac: salesRealized > 0 ? (investmentRealized / salesRealized) : 0,
                roi: roiMultiplier, // Sending Multiplier
                conversionRate: conversionRate,
                impressions,
                clicks
            },
            roi,
            investmentPrc,
            cplPrc,
            wonDeals, // Expose for product table usage
            leadsList // Expose for product efficiency usage
        };

    }, [data, company.id, dateRange, activeTab]);

    const { targets, realized, roi, investmentPrc, cplPrc, wonDeals, leadsList } = metrics;

    // C. Product/Insurance Efficiency
    // Group leads by product keywords (from campaign name)
    // Group sales by the NEW 'product' column
    const productStats = {};
    const campaignsList = effectiveCampaigns.filter(c => String(c.companyId || c.company_id) === String(company.id)); // Assuming effectiveCampaigns is available

    // 1. Group Active Leads by Campaign Tags
    leadsList.forEach(lead => {
        const campaign = campaignsList.find(c => c.id === lead.campaign_id);
        const cName = campaign?.name || '';
        let productKey = 'Outros';

        // Use defined products for grouping
        PRODUCT_DEFINITIONS.forEach(def => {
            if (cName.toLowerCase().includes(normalize(def.label)) || def.keywords.some(kw => cName.toLowerCase().includes(normalize(kw)))) {
                productKey = def.label;
            }
        });

        if (!productStats[productKey]) {
            productStats[productKey] = { name: productKey, leads: 0, sales: 0, volume: 0 };
        }
        productStats[productKey].leads++;
    });

    // 2. Group Won Deals by ACTUAL product column
    wonDeals.forEach(deal => {
        let pName = deal.product || 'Outros';

        // Normalize product names to match keys
        if (pName.toLowerCase().includes('condomin')) pName = 'Condominial';
        else if (pName.toLowerCase().includes('sindico')) pName = 'RC Síndico';
        else if (pName.toLowerCase().includes('auto')) pName = 'Automóvel';
        else if (pName.toLowerCase().includes('residenc')) pName = 'Residencial';
        else if (pName.toLowerCase().includes('vida')) pName = 'Vida';

        if (!productStats[pName]) {
            productStats[pName] = { name: pName, leads: 0, sales: 0, volume: 0 };
        }
        productStats[pName].sales++;
        productStats[pName].volume += deal.amount;
    });

    // 3. Convert to array and sort
    const productEfficiency = Object.values(productStats)
        .sort((a, b) => b.volume - a.volume); // Sort by volume for product efficiency

    // Top Performers Logic (UTM based)
    const topPerformers = useMemo(() => {
        const type = creativesTab === 'creatives' ? 'utm_content' : 'utm_campaign';

        // 1. Use wonDeals (Total 88) but FILTER strictly by Tag for this chart
        // User Request: "só quero vendas que tenham a tag META ADS"
        const relevantSales = (metrics.wonDeals || []).filter(d =>
            d.labels?.some(label =>
                label?.toUpperCase().includes('META ADS') ||
                label?.toUpperCase() === 'META ADS'
            )
        );

        // 2. Aggregate
        const stats = {};
        relevantSales.forEach(s => {
            // Get raw UTM value
            let key = s[type];

            // Clean up common pipefy artifacts if present (e.g. ["value"])
            if (key && typeof key === 'string') {
                if (key.startsWith('["') && key.endsWith('"]')) {
                    key = key.replace('["', '').replace('"]', '');
                }
            }

            if (!key) key = 'Não Identificado'; // Include deals without UTMs

            if (!stats[key]) {
                stats[key] = { name: key, count: 0, revenue: 0 };
            }
            stats[key].count += 1;
            stats[key].revenue += (s.amount || 0);
        });

        // 3. Convert to array and sort
        return Object.values(stats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5); // Top 5
    }, [data, company.id, dateRange, creativesTab]);

    // Animation Variants
    const tabVariants = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.2 }
    };

    const toggleExtraCards = () => {
        const next = !showExtraCards;
        setShowExtraCards(next);
        localStorage.setItem('plin_mkt_extraCards', JSON.stringify(next));
    };
    const toggleDetails = () => {
        const next = !showDetails;
        setShowDetails(next);
        localStorage.setItem('plin_mkt_showDetails', JSON.stringify(next));
    };

    // Badge de saúde calculado: proporcional ao dia do mês
    const healthBadge = useMemo(() => {
        if (!targets.revenue || targets.revenue === 0) return null;
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const proportionalTarget = (targets.revenue / daysInMonth) * daysPassed;
        const achievement = proportionalTarget > 0 ? (realized.volume / proportionalTarget) * 100 : null;
        if (achievement === null) return null;
        if (achievement >= 70) return { label: 'No Ritmo', color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' };
        if (achievement >= 40) return { label: 'Atenção', color: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' };
        return { label: 'Abaixo', color: 'bg-red-500/15 text-red-400 border border-red-500/30' };
    }, [targets.revenue, realized.volume]);

    return (
        <div className="space-y-8 pb-12 w-full max-w-full overflow-x-hidden">
            {/* 1. Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Marketing Performance</h2>
                    <p className="text-[var(--text-secondary)]">Acompanhamento estratégico de campanhas e conversão</p>
                </div>
                <div className="flex items-center gap-3">
                    {healthBadge && (
                        <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full', healthBadge.color)}>
                            {healthBadge.label}
                        </span>
                    )}
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                </div>
            </div>

            {/* 2. Tabs Navigation */}
            <div className="flex flex-wrap gap-2 p-1 bg-[var(--surface-raised)] rounded-xl w-full md:w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200",
                            activeTab === tab.id
                                ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode='wait'>
                <motion.div
                    key={activeTab}
                    variants={tabVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="space-y-6"
                >

                    {/* ═══ ZONA 1: STATUS DO MÊS (Hero) ═══════════════════════════ */}
                    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
                            {/* ROI */}
                            {(() => {
                                const isGood = roi >= 0;
                                const Icon = roi > 5 ? TrendingUp : roi < -5 ? TrendingDown : Minus;
                                const color = roi > 5 ? 'text-emerald-400' : roi < -5 ? 'text-red-400' : 'text-amber-400';
                                const bg = roi > 5 ? 'bg-emerald-400/10' : roi < -5 ? 'bg-red-400/10' : 'bg-amber-400/10';
                                return (
                                    <div className="p-5 sm:p-7">
                                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">ROI do Mês</p>
                                        <div className="flex items-end gap-3">
                                            <span className={cn("text-4xl font-black tracking-tighter", color)}>
                                                {roi > 0 ? '+' : ''}{formatNumber(roi.toFixed(0))}%
                                            </span>
                                            <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1", bg, color)}>
                                                <Icon className="w-3 h-3" />
                                                {roi > 5 ? 'Positivo' : roi < -5 ? 'Negativo' : 'Neutro'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-2">Retorno sobre investimento</p>
                                    </div>
                                );
                            })()}

                            {/* Ritmo da Meta */}
                            {(() => {
                                const pct = targets.investment > 0 ? (realized.investment / targets.investment) * 100 : null;
                                // Projeção de fechamento: (realizado / dias passados) * dias no mês
                                const now = new Date();
                                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                const daysPassed = now.getDate();
                                const projectedInvestment = daysPassed > 0 ? (realized.investment / daysPassed) * daysInMonth : realized.investment;
                                const Icon = !pct ? Minus : pct >= 70 ? TrendingUp : pct >= 40 ? Minus : TrendingDown;
                                const color = !pct ? 'text-amber-400' : pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
                                const bg = !pct ? 'bg-amber-400/10' : pct >= 70 ? 'bg-emerald-400/10' : pct >= 40 ? 'bg-amber-400/10' : 'bg-red-400/10';
                                return (
                                    <div className="p-5 sm:p-7">
                                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Ritmo da Meta</p>
                                        <div className="flex items-end gap-3 flex-wrap">
                                            <span className={cn("text-3xl font-black tracking-tight", color)}>
                                                {pct !== null ? `${pct.toFixed(0)}%` : '–'}
                                            </span>
                                            <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1", bg, color)}>
                                                <Icon className="w-3 h-3" />
                                                {pct !== null ? 'atingido' : 'sem meta'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-2">
                                            {realized.investment > 0 && targets.investment > 0
                                                ? `Projeção: ${formatCurrency(projectedInvestment)} ao fim do mês`
                                                : targets.investment > 0 ? `Meta: ${formatCurrency(targets.investment)}` : 'Meta não definida'}
                                        </p>
                                    </div>
                                );
                            })()}

                            {/* Volume em Apólices / Contratos */}
                            {(() => {
                                const salesTarget = targets.sales;
                                const pct = salesTarget > 0 ? (realized.sales / salesTarget) * 100 : null;
                                const color = !pct || pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
                                const Icon = !pct || pct >= 70 ? TrendingUp : pct >= 40 ? Minus : TrendingDown;
                                const bg = !pct || pct >= 70 ? 'bg-emerald-400/10' : pct >= 40 ? 'bg-amber-400/10' : 'bg-red-400/10';
                                return (
                                    <div className="p-5 sm:p-7">
                                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{labelVolume}</p>
                                        <div className="flex items-end gap-3 flex-wrap">
                                            <span className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                                {formatCurrency(realized.volume)}
                                            </span>
                                            <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1", bg, color)}>
                                                <Icon className="w-3 h-3" />
                                                {realized.sales} {labelVendas}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-2">Receita total via Meta Ads</p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* ═══ ZONA 2: MÉTRICAS ESSENCIAIS (3 cards únicos) ═══════════ */}
                    {activeTab === 'geral' && (
                        <div className="space-y-3">
                            {/* 3 Mini-cards únicos — sem duplicação com hero ou cards de detalhe */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Taxa de Conversão */}
                                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 hover:-translate-y-0.5">
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Activity className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">Taxa de Conversão</p>
                                        </div>
                                        {realized.leads === 0 ? (
                                            <p className="text-sm text-[var(--text-muted)] font-medium mt-1">Sem dados no período</p>
                                        ) : (
                                            <>
                                                <p className="text-lg font-black text-[var(--text-primary)] truncate">{(realized.conversionRate || 0).toFixed(1)}%</p>
                                                <p className="text-[10px] text-[var(--text-muted)] mt-1">Lead → Venda</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ROI (%) */}
                                {(() => {
                                    const roiColor = roi > 5 ? 'text-emerald-400' : roi < -5 ? 'text-red-400' : 'text-amber-400';
                                    const roiLabel = roi > 5 ? 'Positivo' : roi < -5 ? 'Negativo' : 'Neutro';
                                    const roiStatusColor = roi > 5 ? 'text-emerald-400' : roi < -5 ? 'text-red-400' : 'text-amber-400';
                                    return (
                                        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 hover:-translate-y-0.5">
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <TrendingUp className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">ROI</p>
                                                </div>
                                                <p className={cn("text-lg font-black truncate", roiColor)}>
                                                    {roi > 0 ? '+' : ''}{roi.toFixed(0)}%
                                                </p>
                                                <p className={cn("text-[10px] font-medium mt-1", roiStatusColor)}>{roiLabel}</p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Meta CPL */}
                                {(() => {
                                    const cplOk = targets.cpl > 0 && realized.cpl > 0;
                                    const cplStatus = !cplOk ? null : realized.cpl <= targets.cpl ? 'na-meta' : realized.cpl <= targets.cpl * 1.3 ? 'atencao' : 'acima';
                                    const statusColor = cplStatus === 'na-meta' ? 'text-emerald-400' : cplStatus === 'atencao' ? 'text-amber-400' : cplStatus === 'acima' ? 'text-red-400' : 'text-[var(--text-muted)]';
                                    const statusLabel = cplStatus === 'na-meta' ? 'Na Meta' : cplStatus === 'atencao' ? 'Atenção' : cplStatus === 'acima' ? 'Acima' : '–';
                                    return (
                                        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 hover:-translate-y-0.5">
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Target className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">Meta CPL</p>
                                                </div>
                                                <p className="text-lg font-black text-[var(--text-primary)] truncate">
                                                    {targets.cpl > 0 ? formatCurrency(targets.cpl) : '–'}
                                                </p>
                                                {cplStatus && (
                                                    <p className={cn("text-[10px] font-bold mt-1", statusColor)}>{statusLabel}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Toggle extra cards */}
                            <button
                                onClick={toggleExtraCards}
                                className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                            >
                                {showExtraCards ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {showExtraCards ? 'Ocultar indicadores extras' : 'Mostrar todos os indicadores'}
                            </button>

                            {/* Extra Cards (hidden by default) */}
                            {showExtraCards && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Leads Orgânicos */}
                                    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Leaf className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">Leads Orgânicos</p>
                                        </div>
                                        <p className="text-lg font-black text-[var(--text-primary)] truncate">
                                            {data?.sales?.filter(s => {
                                                const isCurrentCompany = String(s.companyId || s.company_id) === String(company.id);
                                                const isInRange = filterByDateRange([s], dateRange, 'createdAt').length > 0;
                                                return isCurrentCompany && isInRange && s.labels?.some(l => l?.toUpperCase().includes('ORGÂNICO IG'));
                                            }).length || 0}
                                        </p>
                                    </div>

                                    {/* Custo de Aquisição (CAC) */}
                                    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Users className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">Custo de Aquisição</p>
                                        </div>
                                        <p className="text-lg font-black text-[var(--text-primary)] truncate">
                                            {(() => {
                                                const metaSales = data?.sales?.filter(s => {
                                                    const isCurrentCompany = String(s.companyId || s.company_id) === String(company.id);
                                                    const isInRange = filterByDateRange([s], dateRange, 'wonDate').length > 0;
                                                    const isWon = s.status === 'won';
                                                    const hasMetaTag = s.labels?.some(label => label?.toUpperCase().includes('META ADS'));
                                                    return isCurrentCompany && isInRange && isWon && hasMetaTag;
                                                }).length || 0;
                                                return metaSales > 0 ? formatCurrency(realized.investment / metaSales) : formatCurrency(0);
                                            })()}
                                        </p>
                                    </div>

                                    {/* Retorno s/ Invest. */}
                                    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <TrendingUp className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">Retorno s/ Invest.</p>
                                        </div>
                                        <p className="text-lg font-black text-[var(--text-primary)] truncate">{(realized.roi || 0).toFixed(1)}x</p>
                                    </div>

                                    {/* Perdas */}
                                    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Ban className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">Perdas</p>
                                        </div>
                                        <p className="text-lg font-black text-red-500 truncate">{realized.lost}</p>
                                        <p className="text-[10px] text-red-400 font-medium mt-1">
                                            {realized.leads > 0 ? ((realized.lost / realized.leads) * 100).toFixed(1) : 0}% dos leads
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ ZONA 3: DETALHAMENTO (colapsável) ══════════════════════ */}
                    {activeTab === 'geral' && (
                        <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
                            <button
                                onClick={toggleDetails}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[var(--surface)] hover:bg-[var(--surface-raised)] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                                    <span className="text-sm font-semibold text-[var(--text-primary)]">Funil de Conversão & Top Criativos</span>
                                    <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface-raised)] px-2 py-0.5 rounded-full">Detalhamento</span>
                                </div>
                                {showDetails ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                            </button>

                            {showDetails && (
                                <div className="flex flex-col gap-6 p-5 bg-[var(--surface)] border-t border-[var(--border)]">
                                    {/* Funil de Conversão */}
                                    <div>
                                        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-4">Funil de Conversão</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-4 bg-[var(--surface-raised)] rounded-xl">
                                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Impressões</p>
                                                <p className="text-xl font-bold text-[var(--text-primary)]">{formatNumber(realized.impressions || 0)}</p>
                                            </div>
                                            <div className="p-4 bg-[var(--surface-raised)] rounded-xl">
                                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Cliques</p>
                                                <p className="text-xl font-bold text-[var(--text-primary)]">{formatNumber(realized.clicks || 0)}</p>
                                                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                                    CTR {realized.impressions > 0 ? ((realized.clicks / realized.impressions) * 100).toFixed(2) : 0}%
                                                </p>
                                            </div>
                                            <div className="p-4 bg-[var(--surface-raised)] rounded-xl">
                                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Leads</p>
                                                <p className="text-xl font-bold text-[var(--text-primary)]">{formatNumber(realized.leads || 0)}</p>
                                            </div>
                                            <div className="p-4 bg-[var(--surface-raised)] rounded-xl">
                                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">{labelVendas.charAt(0).toUpperCase() + labelVendas.slice(1)}</p>
                                                <p className="text-xl font-bold text-emerald-400">{realized.sales || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Galeria de Criativos */}
                                    <div>
                                        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-4">Galeria de Criativos</p>
                                        <CreativeGallery
                                            companyId={company.id}
                                            dateRange={dateRange}
                                            cplTarget={targets.cpl || 0}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ ZONA 2B: INVESTIMENTO & EFICIÊNCIA (detalhes operacionais) ═ */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* BLOCK 2: INVESTIMENTO & RESULTADOS — grid 2x2 com todas as métricas operacionais */}
                        <div className="bg-[var(--surface)] p-4 sm:p-6 md:p-8 rounded-2xl border border-[var(--border)] relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-6">
                                <DollarSign className="w-4 h-4 text-[var(--text-muted)]" />
                                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Investimento & Resultados</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Investimento */}
                                {(() => {
                                    const pct = targets.investment > 0 ? (realized.investment / targets.investment) * 100 : null;
                                    const statusColor = pct === null ? 'text-[var(--text-muted)]' : pct <= 100 ? 'text-emerald-400' : 'text-red-400';
                                    const statusLabel = pct === null ? null : pct > 100 ? 'Acima da meta' : pct >= 70 ? 'No Ritmo' : pct >= 40 ? 'Atenção' : 'Abaixo';
                                    return (
                                        <div className="p-4 bg-[var(--surface-raised)] rounded-2xl col-span-2">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Investimento</p>
                                                    <p className="text-3xl font-black text-[var(--text-primary)]">{formatCurrency(realized.investment)}</p>
                                                    {statusLabel && <p className={cn("text-[10px] font-bold mt-1", statusColor)}>{statusLabel}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Meta</p>
                                                    <p className="text-lg font-bold text-[var(--text-secondary)]">{targets.investment > 0 ? formatCurrency(targets.investment) : '–'}</p>
                                                    {pct !== null && (
                                                        <span className={cn("text-xl font-black", pct > 100 ? 'text-red-500' : 'text-emerald-500')}>
                                                            {pct.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Leads */}
                                {(() => {
                                    const pct = targets.leads > 0 ? (realized.leads / targets.leads) * 100 : null;
                                    const statusColor = pct === null ? 'text-[var(--text-muted)]' : pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
                                    const statusLabel = pct === null ? null : pct >= 70 ? 'No Ritmo' : pct >= 40 ? 'Atenção' : 'Abaixo';
                                    return (
                                        <div className="p-4 bg-[var(--surface-raised)] rounded-xl">
                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Leads</p>
                                            {targets.leads > 0 ? (
                                                <p className="text-2xl font-black text-[var(--text-primary)]">
                                                    {realized.leads} <span className="text-sm font-medium text-[var(--text-muted)]">/ {targets.leads}</span>
                                                </p>
                                            ) : (
                                                <p className="text-2xl font-black text-[var(--text-primary)]">{realized.leads}</p>
                                            )}
                                            {statusLabel && <p className={cn("text-[10px] font-bold mt-1", statusColor)}>{statusLabel}</p>}
                                        </div>
                                    );
                                })()}

                                {/* Vendas */}
                                {(() => {
                                    const pct = targets.sales > 0 ? (realized.sales / targets.sales) * 100 : null;
                                    const statusColor = pct === null ? 'text-[var(--text-muted)]' : pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
                                    const statusLabel = pct === null ? null : pct >= 70 ? 'No Ritmo' : pct >= 40 ? 'Atenção' : 'Abaixo';
                                    return (
                                        <div className="p-4 bg-[var(--surface-raised)] rounded-xl">
                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{labelVendas.charAt(0).toUpperCase() + labelVendas.slice(1)}</p>
                                            {targets.sales > 0 ? (
                                                <p className="text-2xl font-black text-emerald-400">
                                                    {realized.sales} <span className="text-sm font-medium text-[var(--text-muted)]">/ {targets.sales}</span>
                                                </p>
                                            ) : realized.sales === 0 ? (
                                                <p className="text-2xl font-black text-[var(--text-muted)]">0</p>
                                            ) : (
                                                <p className="text-2xl font-black text-emerald-400">{realized.sales}</p>
                                            )}
                                            {statusLabel && <p className={cn("text-[10px] font-bold mt-1", statusColor)}>{statusLabel}</p>}
                                        </div>
                                    );
                                })()}

                                {/* CPL Realizado */}
                                {(() => {
                                    const cplOk = targets.cpl > 0 && realized.cpl > 0;
                                    const statusColor = !cplOk ? 'text-[var(--text-muted)]' : realized.cpl <= targets.cpl ? 'text-emerald-400' : realized.cpl <= targets.cpl * 1.3 ? 'text-amber-400' : 'text-red-400';
                                    const statusLabel = !cplOk ? null : realized.cpl <= targets.cpl ? 'Na Meta' : realized.cpl <= targets.cpl * 1.3 ? 'Atenção' : 'Acima';
                                    return (
                                        <div className="p-4 bg-[var(--surface-raised)] rounded-xl col-span-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">CPL Realizado</p>
                                                    <p className="text-2xl font-black text-[var(--text-primary)]">
                                                        {realized.leads > 0 ? formatCurrency(realized.cpl) : <span className="text-[var(--text-muted)] text-xl font-medium">–</span>}
                                                    </p>
                                                    {statusLabel && <p className={cn("text-[10px] font-bold mt-1", statusColor)}>{statusLabel}</p>}
                                                </div>
                                                {targets.cpl > 0 && (
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Meta CPL</p>
                                                        <p className="text-lg font-bold text-[var(--text-secondary)]">{formatCurrency(targets.cpl)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* BLOCK 3: EFICIÊNCIA (CPL) */}
                        <div className="bg-[var(--surface)] p-4 sm:p-6 md:p-8 rounded-2xl border border-[var(--border)] relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-6">
                                <Target className="w-4 h-4 text-[var(--text-muted)]" />
                                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Eficiência CPL</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="p-4 bg-[var(--surface-raised)] rounded-2xl flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">CPL Realizado</p>
                                        <p className="text-3xl font-black text-[var(--text-primary)]">
                                            {realized.leads > 0 ? formatCurrency(realized.cpl) : <span className="text-xl font-medium text-[var(--text-muted)]">–</span>}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Meta CPL</p>
                                        <p className="text-lg font-bold text-[var(--text-secondary)]">{targets.cpl > 0 ? formatCurrency(targets.cpl) : '–'}</p>
                                    </div>
                                </div>

                                {/* CAC — informação única, não exibida nos demais cards */}
                                <div className="p-4 bg-[var(--surface-raised)] rounded-2xl">
                                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Custo de Aquisição (CAC)</p>
                                    <p className="text-3xl font-black text-[var(--text-primary)]">
                                        {realized.cac > 0 ? formatCurrency(realized.cac) : <span className="text-[var(--text-muted)] text-xl font-medium">Sem {labelVendas}</span>}
                                    </p>
                                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Investimento ÷ {labelVendas.charAt(0).toUpperCase() + labelVendas.slice(1)}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Placeholder for future detailed charts */}
                    <div className="text-center text-xs text-[var(--text-muted)] pt-8 opacity-50">
                        Dados filtrados para: {TABS.find(t => t.id === activeTab)?.label}
                    </div>

                </motion.div >
            </AnimatePresence >
        </div >
    );
}
