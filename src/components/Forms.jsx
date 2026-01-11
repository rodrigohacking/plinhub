import React, { useState } from 'react';
import { toast } from 'sonner';
import { saveData } from '../lib/storage';
import { Lock, Save } from 'lucide-react';

export function Forms({ company, data, type, onSuccess }) {
    const [formData, setFormData] = useState({});
    const [selectedSdr, setSelectedSdr] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const timestamp = new Date().toISOString();

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
        } else if (type === 'set-goals') {
            // Real implementation: Save to data.goals
            if (!data.goals) data.goals = [];

            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const goalIndex = data.goals.findIndex(g => g.companyId === company.id && g.month === currentMonth);

            // Extract SDR Goals
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

            // Update only modified SDRs
            Object.keys(sdrGoalsFromForm).forEach(sdr => {
                finalSdrGoals[sdr] = { ...(finalSdrGoals[sdr] || {}), ...sdrGoalsFromForm[sdr] };
            });

            const newGoal = {
                companyId: company.id,
                month: currentMonth,
                // Use form data if present, otherwise fallback to existing
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

            console.log("Goals Saved:", newGoal);
            toast.success('Metas atualizadas com sucesso! 🚀', {
                description: 'O Dashboard foi sincronizado com as novas metas.',
                style: { background: '#10b981', color: 'white', border: 'none' }, // Custom style for extra pop
            });
        }

        saveData(data);
        onSuccess();
        // Removed alert for better UX, usually handled by parent or toast
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

                {type === 'set-goals' && (
                    <>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-500/20 rounded-xl mb-4">
                            <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                As metas serão auditadas pelo gestor.
                            </p>
                        </div>

                        {/* Global Goals */}
                        <div className="grid grid-cols-2 gap-6 pb-6 border-b border-gray-100 dark:border-white/5 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Receita (MRR)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3.5 text-gray-400 text-sm">R$</span>
                                    <input required type="number" name="revenue_goal" onChange={handleChange} className="w-full pl-10 p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" placeholder="60.000,00" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Vendas (Qtd)</label>
                                <input required type="number" name="deals_goal" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" placeholder="16" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Meta de Leads (Marketing)</label>
                            <input required type="number" name="leads_goal" onChange={handleChange} className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all" placeholder="150" />
                        </div>

                        {/* Individual SDR Goals */}
                        <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Metas Individuais (SDRs)</h3>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecione o Vendedor para Definir a Meta</label>
                                <select
                                    value={selectedSdr}
                                    onChange={(e) => setSelectedSdr(e.target.value)}
                                    className="w-full p-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                >
                                    <option value="">Selecione um vendedor...</option>
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
                    </>
                )}

                <button
                    type="submit"
                    className="w-full py-4 bg-[#FD295E] hover:bg-[#e11d48] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-6"
                >
                    <Save className="w-5 h-5" />
                    Salvar Alterações
                </button>
            </form>
        </div>
    );
}
