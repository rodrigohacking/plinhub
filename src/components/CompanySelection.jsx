import React, { useState, useEffect } from 'react';
import { Building2, ArrowRight, Plus, Edit, Trash2, Save, X, Upload } from 'lucide-react';
import { Background3D } from './ui/Background3D';
import { getCompaniesConfig, saveCompanyConfig, deleteCompanyConfig, checkAdminPin, getAdminPin } from '../lib/storage';

export function CompanySelection({ data, onSelect }) {
    console.log("COMPANY_SELECTION: Rendering full version", data);

    const [companies, setCompanies] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pendingAction, setPendingAction] = useState(null);

    const [formData, setFormData] = useState({
        id: null,
        name: '',
        cnpj: '',
        logo: '',
        pipefyOrgId: '',
        pipefyPipeId: '',
        pipefyToken: '',
        metaAdAccountId: '',
        metaToken: ''
    });

    useEffect(() => {
        if (data && data.companies) {
            loadCompanies();
        }
    }, [data]);

    // Safety check
    if (!data || !data.companies) {
        console.error("COMPANY_SELECTION: Missing data or companies array", data);
        return <div className="p-10 text-red-500">Erro: Dados inválidos.</div>;
    }

    const loadCompanies = () => {
        try {
            const customCompanies = getCompaniesConfig();
            const allCompanies = [...(data.companies || [])].filter(c => c.id !== 1 && c.id !== 2);

            customCompanies.forEach(custom => {
                if (custom.id === 1 || custom.id === 2) return;
                const existingIndex = allCompanies.findIndex(c => c.id === custom.id);
                if (existingIndex >= 0) {
                    allCompanies[existingIndex] = { ...allCompanies[existingIndex], ...custom };
                } else {
                    allCompanies.push(custom);
                }
            });

            setCompanies(allCompanies);
        } catch (error) {
            console.error("Error loading companies:", error);
        }
    };

    const handleProtectedAction = (action) => {
        const isAuthenticated = sessionStorage.getItem('plin_admin_auth') === 'true';
        if (isAuthenticated) {
            executeAction(action);
        } else {
            setPendingAction(action);
            setShowPinModal(true);
        }
    };

    const executeAction = (action) => {
        if (action.type === 'new') handleNewCompany();
        if (action.type === 'edit') handleEditCompany(action.payload);
        if (action.type === 'delete') handleDeleteCompany(action.payload);
    };

    const verifyPin = () => {
        const storedPin = getAdminPin();
        // Default PIN '0000' if not set for initial setup ease
        const valid = storedPin ? checkAdminPin(pin) : (pin === '0000');

        if (valid) {
            sessionStorage.setItem('plin_admin_auth', 'true');
            setShowPinModal(false);
            setPin('');
            if (pendingAction) executeAction(pendingAction);
            setPendingAction(null);
        } else {
            alert('PIN Incorreto');
        }
    };

    const handleNewCompany = () => {
        setFormData({
            id: Date.now(),
            name: '',
            cnpj: '',
            logo: '',
            pipefyOrgId: '',
            pipefyPipeId: '',
            pipefyToken: '',
            metaAdAccountId: '',
            metaToken: ''
        });
        setEditingCompany(null);
        setShowForm(true);
    };

    const handleEditCompany = (company) => {
        const customCompanies = getCompaniesConfig();
        const customConfig = customCompanies.find(c => c.id === company.id) || {};

        setFormData({
            id: company.id,
            name: company.name,
            cnpj: company.cnpj || '',
            logo: company.logo || '',
            pipefyOrgId: customConfig.pipefyOrgId || '',
            pipefyPipeId: customConfig.pipefyPipeId || '',
            pipefyToken: customConfig.pipefyToken || '',
            metaAdAccountId: customConfig.metaAdAccountId || '',
            metaToken: customConfig.metaToken || ''
        });
        setEditingCompany(company);
        setShowForm(true);
    };

    const handleDeleteCompany = async (companyId) => {
        if (confirm('Tem certeza que deseja excluir esta empresa e todos os seus dados?')) {
            try {
                const response = await fetch(`http://localhost:3001/api/companies/${companyId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('Falha ao excluir no servidor');
            } catch (err) {
                console.warn('Servidor indisponível ou erro na exclusão remota:', err);
            }
            deleteCompanyConfig(companyId);
            loadCompanies();
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, logo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveCompany = () => {
        if (!formData.name) {
            alert('Por favor, preencha o nome da empresa.');
            return;
        }

        saveCompanyConfig(formData);
        setShowForm(false);
        loadCompanies();
        window.location.reload();
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingCompany(null);
    };

    if (showPinModal) {
        return (
            <div className="min-h-screen bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 fixed inset-0 z-[60]">
                <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FD295E]/10 blur-[50px] rounded-full pointer-events-none"></div>

                    <h2 className="text-xl font-bold text-white mb-6 text-center">Permissão Necessária</h2>
                    <p className="text-gray-400 text-sm mb-4 text-center">Digite o PIN de administrador para continuar.</p>

                    <div className="space-y-4">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full text-center text-2xl tracking-[0.5em] p-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white font-mono"
                            placeholder="••••"
                            maxLength={4}
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPinModal(false); setPin(''); }} className="flex-1 py-3 border border-white/10 rounded-lg text-gray-400 hover:bg-white/5 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={verifyPin} className="flex-1 py-3 bg-[#FD295E] text-white rounded-lg hover:bg-[#e02451] font-medium shadow-lg shadow-[#FD295E]/20">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (showForm) {
        return (
            <div className="min-h-screen bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 fixed inset-0 z-50">
                <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative overflow-hidden">
                    {/* Glow effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#FD295E]/5 blur-[100px] rounded-full pointer-events-none"></div>

                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <h2 className="text-2xl font-bold text-white">
                            {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
                        </h2>
                        <button onClick={handleCancelForm} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">Nome da Empresa *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Ex: Apolar Condomínios"
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] focus:border-transparent outline-none text-white placeholder-gray-600 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">CNPJ</label>
                                <input
                                    type="text"
                                    name="cnpj"
                                    value={formData.cnpj}
                                    onChange={handleChange}
                                    placeholder="00.000.000/0001-00"
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] focus:border-transparent outline-none text-white placeholder-gray-600 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Logo</label>
                            <div className="flex items-center gap-4">
                                {formData.logo && (
                                    <div className="w-16 h-16 rounded-lg border border-white/10 p-1 bg-white/5 flex items-center justify-center">
                                        <img src={formData.logo} alt="Logo" className="max-w-full max-h-full object-contain rounded" />
                                    </div>
                                )}
                                <label className="flex-1 cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <div className="w-full p-3 bg-white/5 border border-white/10 border-dashed rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:border-[#FD295E]/50 hover:text-[#FD295E] transition-all flex items-center justify-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        <span>{formData.logo ? 'Alterar logo' : 'Escolher logo'}</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <details className="group border border-white/10 rounded-lg bg-white/[0.02] open:bg-white/[0.04] transition-all">
                            <summary className="font-medium text-gray-300 cursor-pointer p-4 select-none flex items-center justify-between">
                                <span>Integrações (Opcional)</span>
                                <Plus className="w-4 h-4 text-gray-500 group-open:rotate-45 transition-transform" />
                            </summary>
                            <div className="p-4 pt-0 space-y-4 border-t border-white/5 mt-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Pipefy - Pipe ID</label>
                                    <input type="text" name="pipefyPipeId" value={formData.pipefyPipeId} onChange={handleChange} className="w-full p-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Pipefy - Token</label>
                                    <input type="password" name="pipefyToken" value={formData.pipefyToken} onChange={handleChange} className="w-full p-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Meta Ads - Account ID</label>
                                    <input type="text" name="metaAdAccountId" value={formData.metaAdAccountId} onChange={handleChange} className="w-full p-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Meta Ads - Token</label>
                                    <input type="password" name="metaToken" value={formData.metaToken} onChange={handleChange} className="w-full p-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white transition-all" />
                                </div>

                                <div className="pt-4 border-t border-white/10">
                                    <h4 className="text-sm font-semibold text-gray-200 mb-3">Mapeamento de Métricas (Pipefy)</h4>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-500">Fase de Venda Ganha</label>
                                            <input
                                                type="text"
                                                name="pipefyWonPhase"
                                                value={formData.pipefyWonPhase || ''}
                                                onChange={handleChange}
                                                placeholder="Ex: Fechamento - Ganho"
                                                className="w-full p-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white text-sm transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-500">Fase de Venda Perdida</label>
                                            <input
                                                type="text"
                                                name="pipefyLostPhase"
                                                value={formData.pipefyLostPhase || ''}
                                                onChange={handleChange}
                                                placeholder="Ex: Fechamento - Perdido"
                                                className="w-full p-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-white text-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </details>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button onClick={handleCancelForm} className="px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 font-medium text-gray-300 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveCompany} className="px-6 py-3 bg-[#FD295E] text-white rounded-lg hover:bg-[#e02451] font-medium flex items-center gap-2 shadow-lg shadow-[#FD295E]/20 hover:shadow-[#FD295E]/40 transition-all hover:-translate-y-0.5">
                                <Save className="w-5 h-5" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 
    // ...
    return (
        <Background3D>
            <div className="min-h-screen flex items-center justify-center p-4 lg:p-12 relative z-10">
                <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

                    {/* Left Column: Hero Brand (Logo Only) */}
                    <div className="flex flex-col items-center lg:items-start justify-center animate-in slide-in-from-left duration-700 delay-100">
                        <div className="relative group cursor-default mb-6">
                            <div className="absolute -inset-4 bg-gradient-to-r from-[#FD295E] to-[#FF6B6B] rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000"></div>
                            <img
                                src="/logo-hub.png"
                                alt="PLIN HUB"
                                className="relative h-48 md:h-64 lg:h-80 object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-[1.02]"
                            />
                        </div>
                        <div className="max-w-md text-center lg:text-left space-y-2">
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                Gestão Inteligente
                            </h2>
                            <p className="text-gray-400 text-lg leading-relaxed">
                                Conectamos dados, pessoas e resultados em uma única plataforma.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Glass Interaction Panel */}
                    <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl p-8 lg:p-12 animate-in slide-in-from-right duration-700 delay-200 ring-1 ring-white/5">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-3xl font-bold text-white tracking-tight">EMPRESAS:</h2>
                                <p className="text-sm text-gray-400 font-medium tracking-widest">ESCOLHA UMA OPÇÃO ABAIXO</p>
                            </div>
                            <button
                                onClick={() => handleProtectedAction({ type: 'new' })}
                                className="flex items-center gap-2 bg-[#FD295E] hover:bg-[#e02451] text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-[0_4px_20px_rgba(253,41,94,0.3)] hover:shadow-[0_6px_25px_rgba(253,41,94,0.4)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Nova</span>
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {companies.map((company) => (
                                <div
                                    key={company.id}
                                    className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.06] hover:border-[#FD295E]/50 transition-all cursor-pointer hover:shadow-[0_0_30px_rgba(253,41,94,0.1)] duration-300"
                                    onClick={() => onSelect(company)}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-[#FD295E] shrink-0 border border-white/5 shadow-inner group-hover:scale-105 transition-transform">
                                            {company.logo ? (
                                                <img src={company.logo} alt={company.name} className="w-full h-full object-contain rounded-xl p-2" />
                                            ) : (
                                                <Building2 className="w-8 h-8" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-white text-lg truncate group-hover:text-[#FD295E] transition-colors">{company.name}</h3>
                                            <p className="text-xs text-gray-500 truncate font-mono tracking-wider">{company.cnpj || 'CNPJ NÃO INFORMADO'}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#FD295E] group-hover:text-white transition-all transform group-hover:rotate-[-45deg] shadow-lg shadow-transparent group-hover:shadow-[#FD295E]/40">
                                            <ArrowRight className="w-5 h-5" />
                                        </div>
                                    </div>

                                    <div className="absolute top-1/2 -translate-y-1/2 right-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProtectedAction({ type: 'edit', payload: company });
                                            }}
                                            className="p-2 bg-black/50 hover:bg-[#FD295E] rounded-lg text-gray-300 hover:text-white border border-white/5 transition-colors"
                                            title="Editar"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProtectedAction({ type: 'delete', payload: company.id });
                                            }}
                                            className="p-2 bg-black/50 hover:bg-red-500 rounded-lg text-gray-300 hover:text-white border border-white/5 transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {companies.length === 0 && (
                                <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                                    <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                        <Building2 className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <h3 className="text-white font-medium mb-1">Nenhuma organização</h3>
                                    <p className="text-gray-500 text-sm mb-6">Comece cadastrando sua primeira empresa</p>
                                    <button onClick={() => handleProtectedAction({ type: 'new' })} className="text-[#FD295E] text-sm font-semibold hover:text-amber-400 transition-colors uppercase tracking-wider text-xs">
                                        Criar Cadastro &rarr;
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end items-center text-[10px] text-gray-600 uppercase tracking-widest font-medium">
                            <span>PLIN © 2026</span>
                        </div>
                    </div>
                </div>
            </div>
        </Background3D>
    );
}
