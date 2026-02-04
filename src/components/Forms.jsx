import React, { useState } from 'react';
import { toast } from 'sonner';
import { saveData, saveMetric, saveSalesGoal } from '../lib/storage';
import { Lock, Save, Target, Megaphone, CheckCircle, Loader2 } from 'lucide-react';

const PRODUCT_DEFAULTS = {
    'all': { spend: 5000, cpc: 15 },
    'condominial': { spend: 2500, cpc: 30 },
    'rc_sindico': { spend: 1500, cpc: 25 },
    'automovel': { spend: 1000, cpc: 10 },
    'residencial': { spend: 500, cpc: 10 }
};

export function Forms({ company, data, type, onSuccess }) {
    const [formData, setFormData] = useState({});
    const [selectedSdr, setSelectedSdr] = useState('');

    // Marketing Goals State
    const [goalType, setGoalType] = useState('sales'); // 'sales' | 'marketing'
    const [selectedProduct, setSelectedProduct] = useState('');

    // UI Feedback States
    const [status, setStatus] = useState('idle'); // 'idle', 'saving', 'success'

    // Pre-fill existing goals
    React.useEffect(() => {
        if (type === 'set-goals') {
            // 1. Sales Goals Logic
            if (goalType === 'sales' && data.goals) {
                const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
                const currentGoal = data.goals.find(g => String(g.companyId) === String(company.id) && g.month === currentMonth);

                // Fallback to latest if current is missing
                const latestGoal = !currentGoal
                    ? data.goals
                        .filter(g => String(g.companyId) === String(company.id) && g.month < currentMonth)
                        .sort((a, b) => b.month.localeCompare(a.month))[0]
                    : null;

                const existing = currentGoal || latestGoal;

                if (existing) {
                    const sdrState = {};
                    if (existing.sdrGoals) {
                        Object.entries(existing.sdrGoals).forEach(([name, goal]) => {
                            sdrState[`sdr_goal_rev_${name}`] = goal.revenue;
                            sdrState[`sdr_goal_qty_${name}`] = goal.deals;
                        });
                    }

                    setFormData(prev => ({
                        ...prev,
                        revenue_goal: existing.revenue,
                        deals_goal: existing.deals,
                        leads_goal: existing.leads,
                        ...sdrState
                    }));
                }

                // Load marketing goals for non-insurance companies (Apolar)
                if (!company?.name?.toLowerCase().includes('andar')) {
                    const relevantMetrics = (data.metrics || []).filter(m =>
                        String(m.companyId) === String(company.id) &&
                        m.label === 'all' &&
                        m.source === 'manual'
                    );
                    const latestMetric = relevantMetrics.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                    if (latestMetric) {
                        setFormData(prev => ({
                            ...prev,
                            marketing_investment_goal: latestMetric.spend,
                            marketing_cpl_goal: latestMetric.cpc
                        }));
                    }
                }
            }

            // 2. Marketing Product Goals Logic
            else if (goalType === 'marketing' && selectedProduct) {
                // Find latest metric for this product
                const relevantMetrics = (data.metrics || []).filter(m =>
                    String(m.companyId) === String(company.id) &&
                    m.label === selectedProduct
                );
                // Sort by date DESC
                const latestMetric = relevantMetrics.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                if (latestMetric) {
                    setFormData(prev => ({
                        ...prev,
                        marketing_spend: latestMetric.spend,
                        marketing_cpc: latestMetric.cpc,
                        marketing_revenue: latestMetric.revenue // Pre-fill Revenue Goal
                    }));
                } else {
                    // Use Defaults
                    const def = PRODUCT_DEFAULTS[selectedProduct];
                    if (def) {
                        setFormData(prev => ({
                            ...prev,
                            marketing_spend: def.spend,
                            marketing_cpc: def.cpc
                        }));
                    }
                }
            }
        }
    }, [type, data.goals, data.metrics, company.id, goalType, selectedProduct]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const timestamp = new Date().toISOString();
        setStatus('saving');

        // Artificial delay for UX perception (touch feel) if operation is too fast
        const minDelay = new Promise(resolve => setTimeout(resolve, 600));

        if (type === 'add-sale') {
            const newSale = {
                id: `sale_new_${Date.now()}`,
                companyId: company.id,
                date: formData.date || timestamp,
                amount: parseFloat(formData.amount),
                channel: formData.channel || 'Online',
                seller: formData.seller || 'Sistema',
                client: formData.client || 'Cliente Anônimo',
                items: 1, // simplified
                status: 'concluída'
            };
            data.sales.unshift(newSale); // Add to top
            data.sales.unshift(newSale); // Add to top
            saveData(data);
            await minDelay;
            setStatus('success');
            onSuccess();
            setTimeout(() => setStatus('idle'), 2000);
        } else if (type === 'add-campaign') {
            const newCamp = {
                id: `camp_new_${Date.now()}`,
                companyId: company.id,
                name: formData.name,
                investment: parseFloat(formData.investment),
                leads: parseInt(formData.leads || 0),
                clicks: parseInt(formData.clicks || 0),
                impressions: parseInt(formData.impressions || 0),
                conversions: parseInt(formData.conversions || 0),
                channel: formData.channel || 'Outros'
            };
            data.campaigns.unshift(newCamp);
            data.campaigns.unshift(newCamp);
            saveData(data);
            await minDelay;
            setStatus('success');
            onSuccess();
            setTimeout(() => setStatus('idle'), 2000);
        } else if (type === 'set-goals') {

            if (goalType === 'sales') {
                // --- Save Sales Goals (Local Storage Logic) ---
                if (!data.goals) data.goals = [];
                const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7); // YYYY-MM
                const goalIndex = data.goals.findIndex(g => String(g.companyId) === String(company.id) && g.month === currentMonth);

                // Extract SDR Goals
                const sdrGoalsFromForm = {};
                Object.keys(formData).forEach(key => {
                    if (key.startsWith('sdr_goal_rev_')) {
                        const sdrName = key.replace('sdr_goal_rev_', '');
                        if (!sdrGoalsFromForm[sdrName]) sdrGoalsFromForm[sdrName] = {};
                        sdrGoalsFromForm[sdrName].revenue = parseFloat(formData[key]) || 0;
                    }
                    if (key.startsWith('sdr_goal_qty_')) {
                        const sdrName = key.replace('sdr_goal_qty_', '');
                        if (!sdrGoalsFromForm[sdrName]) sdrGoalsFromForm[sdrName] = {};
                        sdrGoalsFromForm[sdrName].deals = parseInt(formData[key]) || 0;
                    }
                });

                // Merge with existing goals
                const existingGoal = goalIndex >= 0 ? data.goals[goalIndex] : {};
                const finalSdrGoals = { ...(existingGoal.sdrGoals || {}) };

                Object.keys(sdrGoalsFromForm).forEach(sdr => {
                    finalSdrGoals[sdr] = { ...(finalSdrGoals[sdr] || {}), ...sdrGoalsFromForm[sdr] };
                });

                const newGoal = {
                    companyId: company.id,
                    month: currentMonth,
                    revenue: formData.revenue_goal ? parseFloat(formData.revenue_goal) : (existingGoal.revenue || 0),
                    deals: formData.deals_goal ? parseInt(formData.deals_goal) : (existingGoal.deals || 0),
                    leads: formData.leads_goal ? parseInt(formData.leads_goal) : (existingGoal.leads || 0),
                    sdrGoals: finalSdrGoals,
                    updatedAt: timestamp
                };

                if (goalIndex >= 0) {
                    data.goals[goalIndex] = { ...data.goals[goalIndex], ...newGoal };
                } else {
                    data.goals.push(newGoal);
                }

                // Call Database Save via API Loop
                try {
                    // await saveSalesGoal(newGoal); // Legacy
                    const response = await fetch('/api/goals', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newGoal)
                    });

                    if (!response.ok) {
                        const err = await response.text();
                        throw new Error(err);
                    }
                    console.log("Goals saved to DB via API");
                } catch (err) {
                    console.error('Failed to save Sales Goal to DB:', err);
                    toast.error('Erro ao salvar meta no banco de dados. Atualização local apenas.');
                }

                saveData(data); // Keep local backup as fallback

                // Save marketing goals for non-insurance companies (Apolar)
                if (!company?.name?.toLowerCase().includes('andar') &&
                    (formData.marketing_investment_goal || formData.marketing_cpl_goal)) {
                    try {
                        const metricParams = {
                            companyId: company.id,
                            label: 'all',
                            source: 'manual',
                            date: timestamp,
                            spend: parseFloat(formData.marketing_investment_goal || 0),
                            cpc: parseFloat(formData.marketing_cpl_goal || 0),
                        };

                        await saveMetric(metricParams);

                        // Optimistic Update
                        if (!data.metrics) data.metrics = [];
                        data.metrics.push(metricParams);
                    } catch (err) {
                        console.error('Error saving marketing goals:', err);
                    }
                }

                await minDelay;
                setStatus('success');

                toast.success('Metas de Vendas atualizadas! 🚀', {
                    style: { background: '#10b981', color: 'white', border: 'none' },
                });

                // Allow user to see "Salvo!" on button before handling success transition
                setTimeout(() => {
                    onSuccess();
                    setStatus('idle');
                }, 1000);

            } else {
                // --- Save Marketing Product Goals (Supabase Metric) ---
                if (!selectedProduct) {
                    toast.error("Selecione um produto.");
                    return;
                }

                try {
                    const metricParams = {
                        companyId: company.id,
                        label: selectedProduct, // 'condominial', etc
                        source: 'manual',
                        date: timestamp, // Unique timestamp acts as "current version" effectively
                        spend: parseFloat(formData.marketing_spend || 0),
                        cpc: parseFloat(formData.marketing_cpc || 0), // Using CPC column for CPL Goal
                        revenue: parseFloat(formData.marketing_revenue || 0) // Saving Revenue Goal
                    };

                    await saveMetric(metricParams);

                    // Optimistic Update Local Data
                    if (!data.metrics) data.metrics = [];
                    data.metrics.push(metricParams);
                    // No need to saveData() for metrics as they are fetched from DB, but we update in-memory for immediate UI reflect
                    // (Though if user refreshes, it fetches from DB).

                    await minDelay;
                    setStatus('success');

                    toast.success(`Metas de ${selectedProduct} salvas!`, {
                        description: 'Novas metas de marketing definidas.',
                        style: { background: '#10b981', color: 'white', border: 'none' }
                    });

                    setTimeout(() => {
                        onSuccess();
                        setStatus('idle');
                    }, 1000);
                } catch (err) {
                    setStatus('idle');
                    toast.error("Erro ao salvar metas.");
                    console.error(err);
                }
            }
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-[#111] p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-white/5 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                {type === 'add-sale' && 'Adicionar Nova Venda'}
                {type === 'add-campaign' && 'Adicionar Nova Campanha'}
                {type === 'set-goals' && 'Definir Metas Mensais'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* --- ADD SALE FORM --- */}
                {type === 'add-sale' && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Total (R$)</label>
                                <input required type="number" name="amount" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                                <input required type="date" name="date" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Canal</label>
                            <select name="channel" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all">
                                <option value="Online">Online</option>
                                <option value="Loja Física">Loja Física</option>
                                <option value="Telefone">Telefone</option>
                                <option value="Marketplace">Marketplace</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                            <input type="text" name="client" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" placeholder="Nome do Cliente" />
                        </div>
                    </>
                )}

                {/* --- ADD CAMPAIGN FORM --- */}
                {type === 'add-campaign' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Campanha</label>
                            <input required type="text" name="name" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Investimento (R$)</label>
                                <input required type="number" name="investment" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Canal</label>
                                <select name="channel" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all">
                                    <option value="Google Ads">Google Ads</option>
                                    <option value="Facebook">Facebook</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="Email">Email</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Impressões</label>
                                <input type="number" name="impressions" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cliques</label>
                                <input type="number" name="clicks" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Leads</label>
                                <input type="number" name="leads" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Conversões</label>
                                <input type="number" name="conversions" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" />
                            </div>
                        </div>
                    </>
                )}

                {/* --- SET GOALS FORM --- */}
                {type === 'set-goals' && (
                    <>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-500/20 rounded-xl mb-4">
                            <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                As metas serão auditadas pelo gestor.
                            </p>
                        </div>

                        {/* Top Goal Type Switcher */}
                        <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-6">
                            <button
                                type="button"
                                onClick={() => setGoalType('sales')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${goalType === 'sales' ? 'bg-white dark:bg-[#1a1a1a] shadow text-[#FD295E]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                <Target className="w-4 h-4" />
                                Vendas (Geral)
                            </button>
                            {/* Only show Marketing tab for insurance companies (Andar) */}
                            <button
                                type="button"
                                onClick={() => setGoalType('marketing')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${goalType === 'marketing' ? 'bg-white dark:bg-[#1a1a1a] shadow text-[#FD295E]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                <Megaphone className="w-4 h-4" />
                                Marketing (Por Produto)
                            </button>
                        </div>

                        {/* SALES GOALS CONTENT */}
                        {goalType === 'sales' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-gray-100 dark:border-white/5 mb-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Receita (MRR)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3.5 text-gray-400 text-sm">R$</span>
                                            <input
                                                type="number"
                                                name="revenue_goal"
                                                value={formData.revenue_goal || ''}
                                                onChange={handleChange}
                                                className="w-full pl-10 p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                                placeholder="60.000,00"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Vendas (Qtd)</label>
                                        <input
                                            type="number"
                                            name="deals_goal"
                                            value={formData.deals_goal || ''}
                                            onChange={handleChange}
                                            className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                            placeholder="16"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Leads (Marketing)</label>
                                    <input
                                        type="number"
                                        name="leads_goal"
                                        value={formData.leads_goal || ''}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                        placeholder="150"
                                    />
                                </div>



                                {/* Individual SDR Goals */}
                                <div className="pt-6 border-t border-gray-100 dark:border-white/5 mt-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Metas Individuais (SDRs)</h3>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecione o Vendedor</label>
                                        <select
                                            value={selectedSdr}
                                            onChange={(e) => setSelectedSdr(e.target.value)}
                                            className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="all">Ver Todos</option>
                                            {Array.from(new Set(data.sales.filter(s => s.companyId === company.id).map(s => s.seller))).filter(s => s !== 'Sistema' && s !== 'SDR').sort().map((sdr, idx) => (
                                                <option key={idx} value={sdr}>{sdr}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-4">
                                        {Array.from(new Set(data.sales.filter(s => s.companyId === company.id).map(s => s.seller)))
                                            .filter(s => s !== 'Sistema' && s !== 'SDR')
                                            .filter(s => {
                                                if (!selectedSdr) return false;
                                                if (selectedSdr === 'all') return true;
                                                return s === selectedSdr;
                                            })
                                            .map((sdr, idx) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <div className="w-full md:w-1/3">
                                                        <p className="font-bold text-gray-700 dark:text-gray-200">{sdr}</p>
                                                        <p className="text-xs text-gray-400">Vendedor</p>
                                                    </div>
                                                    <div className="flex-1 w-full grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Meta R$</label>
                                                            <input
                                                                type="number"
                                                                name={`sdr_goal_rev_${sdr}`}
                                                                value={formData[`sdr_goal_rev_${sdr}`] || ''}
                                                                onChange={handleChange}
                                                                placeholder="15.000"
                                                                className="w-full p-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#111] focus:ring-1 focus:ring-[#FD295E] outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Meta Qtd</label>
                                                            <input
                                                                type="number"
                                                                name={`sdr_goal_qty_${sdr}`}
                                                                value={formData[`sdr_goal_qty_${sdr}`] || ''}
                                                                onChange={handleChange}
                                                                placeholder="4"
                                                                className="w-full p-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#111] focus:ring-1 focus:ring-[#FD295E] outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MARKETING PRODUCT GOALS CONTENT */}
                        {goalType === 'marketing' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Produto</label>
                                    <select
                                        value={selectedProduct}
                                        onChange={(e) => setSelectedProduct(e.target.value)}
                                        className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                    >
                                        <option value="">Selecione o produto...</option>
                                        <option value="all">Geral</option>
                                        <option value="condominial">Condominial</option>
                                        <option value="rc_sindico">RC Síndico</option>
                                        <option value="automovel">Automóvel</option>
                                        <option value="residencial">Residencial</option>
                                    </select>
                                </div>

                                {selectedProduct && (
                                    <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Investimento Meta</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3.5 text-gray-400 text-sm">R$</span>
                                                <input
                                                    required
                                                    type="number"
                                                    name="marketing_spend"
                                                    value={formData.marketing_spend || ''}
                                                    onChange={handleChange}
                                                    className="w-full pl-10 p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Valor alvo para o investimento mensal.</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Faturamento</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3.5 text-gray-400 text-sm">R$</span>
                                                <input
                                                    required
                                                    type="number"
                                                    name="marketing_revenue"
                                                    value={formData.marketing_revenue || ''}
                                                    onChange={handleChange}
                                                    className="w-full pl-10 p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Valor alvo de retorno (ROAS).</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de CPL</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3.5 text-gray-400 text-sm">R$</span>
                                                <input
                                                    required
                                                    type="number"
                                                    name="marketing_cpc"
                                                    value={formData.marketing_cpc || ''}
                                                    onChange={handleChange}
                                                    className="w-full pl-10 p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Custo máximo desejado por lead.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                <button
                    type="submit"
                    disabled={status !== 'idle'}
                    className={`
                        w-full py-4 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-6
                        ${status === 'saving' ? 'bg-[#FD295E]/70 cursor-wait' : ''}
                        ${status === 'success' ? 'bg-green-500 hover:bg-green-600' : 'bg-[#FD295E] hover:bg-[#e11d48]'}
                        ${status === 'idle' ? 'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' : ''} 
                        text-white
                    `}
                >
                    {status === 'saving' ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Salvando...
                        </>
                    ) : status === 'success' ? (
                        <>
                            <CheckCircle className="w-5 h-5 animate-in zoom-in spin-in-50 duration-300" />
                            Salvo com Sucesso!
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Salvar Alterações
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
