import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Building2, ArrowRight, Plus, Edit, Trash2, Save, X, Upload, Lock, Loader2 } from 'lucide-react';
import { Background3D } from './ui/Background3D';
import { getCompaniesConfig, saveCompanyConfig, deleteCompanyConfig, checkAdminPin, getAdminPin, setAdminPin } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';

export function CompanySelection({ data, onSelect }) {
    console.log("COMPANY_SELECTION: Rendering full version", data);

    const [companies, setCompanies] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pendingAction, setPendingAction] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Debug Info
    const { user } = useAuth();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'MISSING';

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

    // Force Reset PIN to 4565 (User Request)
    useEffect(() => {
        setAdminPin('4565');
    }, []);

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
            // Fix: Trust the data provided by App.jsx (via getData) which already handles:
            // 1. Fetching from DB
            // 2. Merging with Local Storage
            // 3. Deduplicating by Name/ID
            // We just need to filter out the dummy IDs (1 and 2) if they still exist.
            const allCompanies = [...(data.companies || [])].filter(c => c.id !== 1 && c.id !== 2);
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
        if (action.type === 'delete') handleDeleteClick(action.payload);
    };

    const verifyPin = () => {
        const storedPin = getAdminPin();
        const valid = storedPin ? checkAdminPin(pin) : (pin === '0000');

        if (valid) {
            sessionStorage.setItem('plin_admin_auth', 'true');
            setShowPinModal(false);
            setPin('');
            if (pendingAction) executeAction(pendingAction);
            setPendingAction(null);
        } else {
            toast.error('PIN Incorreto. Tente novamente.');
            setPin(''); // Clear input on error for better UX
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

    const [companyToDelete, setCompanyToDelete] = useState(null);

    // ... state

    // ...

    const handleDeleteClick = (companyId) => {
        setCompanyToDelete(companyId);
    };

    const confirmDelete = async () => {
        if (!companyToDelete) return;

        const companyId = companyToDelete;
        try {
            const response = await fetch(`/api/companies/${companyId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Falha ao excluir no servidor');
            }

            setCompanies(prev => prev.filter(c => String(c.id) !== String(companyId)));
            toast.success('Empresa excluída com sucesso.');
            deleteCompanyConfig(companyId);
        } catch (err) {
            console.error('Erro na exclusão:', err);
            toast.error('Erro ao excluir empresa.');
        } finally {
            setCompanyToDelete(null);
        }
    };

    // Replace old handleDeleteCompany with executeAction logic update below

    // ...



    // ...

    const handleCompanyClick = (company) => {
        // Optimistic Click: Don't await. Trigger selection and let data load in background on Dashboard.
        onSelect(company);
    };

    const fileInputRef = React.useRef(null);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 250; // Resize to ensure it fits in DB/Storage

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL('image/png'); // Use PNG for transparency if logo has it
                    setFormData(prev => ({ ...prev, logo: compressedBase64 }));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Background3D>


            {/* PIN Protection Modal */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-8 max-w-sm w-full relative overflow-hidden ring-1 ring-[#FD295E]/20">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FD295E]/10 blur-[50px] rounded-full pointer-events-none"></div>

                        <div className="relative z-10 text-center mb-6">
                            <div className="w-16 h-16 bg-[#FD295E]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FD295E]/20">
                                <Lock className="w-8 h-8 text-[#FD295E]" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Acesso Restrito</h3>
                            <p className="text-gray-400 text-sm">
                                Digite o PIN de administrador para continuar.
                            </p>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="PIN"
                                className="w-full text-center text-2xl tracking-[0.5em] bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-[#FD295E] outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:text-gray-600"
                                maxLength={4}
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowPinModal(false);
                                        setPin('');
                                        setPendingAction(null);
                                    }}
                                    className="flex-1 py-3 border border-white/10 rounded-lg text-gray-300 hover:bg-white/5 transition-colors font-medium text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={verifyPin}
                                    className="flex-1 py-3 bg-[#FD295E] hover:bg-[#e02451] text-white rounded-lg font-bold shadow-lg shadow-[#FD295E]/20 transition-all hover:scale-[1.02] text-sm"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Company Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-8 max-w-2xl w-full relative overflow-y-auto max-h-[90vh] ring-1 ring-[#FD295E]/20 custom-scrollbar">
                        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingCompany ? <Edit className="w-5 h-5 text-[#FD295E]" /> : <Plus className="w-5 h-5 text-[#FD295E]" />}
                                {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Nome da Empresa</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-[#FD295E] outline-none"
                                        placeholder="Ex: Minha Construtora"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">CNPJ</label>
                                    <input
                                        type="text"
                                        value={formData.cnpj}
                                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-[#FD295E] outline-none"
                                        placeholder="00.000.000/0000-00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Logo da Empresa</label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                    accept="image/*"
                                />
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-white/10 rounded-xl bg-black/30 hover:bg-white/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
                                >
                                    {formData.logo ? (
                                        <div className="relative w-full h-full p-2">
                                            <img src={formData.logo} alt="Preview" className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                                <span className="text-white text-sm font-medium">Alterar Logo</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-gray-400 group-hover:text-[#FD295E]" />
                                            </div>
                                            <span className="text-sm text-gray-400">Clique para enviar uma imagem</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-6">
                                <h4 className="text-sm font-bold text-[#FD295E] mb-4 uppercase tracking-wider">Integração Pipefy</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Organization ID</label>
                                        <input
                                            type="text"
                                            value={formData.pipefyOrgId}
                                            onChange={(e) => setFormData({ ...formData, pipefyOrgId: e.target.value })}
                                            className="w-full bg-black/30 border border-white/5 rounded-lg p-2.5 text-sm text-gray-300 focus:border-[#FD295E]/50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Pipe ID (Vendas)</label>
                                        <input
                                            type="text"
                                            value={formData.pipefyPipeId}
                                            onChange={(e) => setFormData({ ...formData, pipefyPipeId: e.target.value })}
                                            className="w-full bg-black/30 border border-white/5 rounded-lg p-2.5 text-sm text-gray-300 focus:border-[#FD295E]/50 outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Personal Access Token</label>
                                        <input
                                            type="password"
                                            value={formData.pipefyToken}
                                            onChange={(e) => setFormData({ ...formData, pipefyToken: e.target.value })}
                                            className="w-full bg-black/30 border border-white/5 rounded-lg p-2.5 text-sm text-gray-300 focus:border-[#FD295E]/50 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-3 border border-white/10 rounded-xl text-gray-300 hover:bg-white/5 transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!formData.name) return toast.error('Nome é obrigatório');

                                        setIsLoading(true);
                                        try {
                                            await saveCompanyConfig(formData); // Handles both create and update
                                            toast.success(editingCompany ? 'Empresa atualizada!' : 'Empresa criada!');
                                            setShowForm(false);
                                            // Optimistic update handled by App.jsx data refresh or reload
                                            // Ideally we trigger a reload here, but saveCompanyConfig should handle it
                                            window.location.reload(); // Simple brute force refresh
                                        } catch (err) {
                                            console.error(err);
                                            toast.error('Erro ao salvar.');
                                        } finally {
                                            setIsLoading(false);
                                        }
                                    }}
                                    disabled={isLoading}
                                    className="px-6 py-3 bg-[#FD295E] hover:bg-[#e02451] text-white rounded-xl font-bold shadow-lg shadow-[#FD295E]/20 transition-all hover:scale-[1.02] flex items-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    {editingCompany ? 'Salvar Alterações' : 'Criar Empresa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Delete Modal */}
            {companyToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-6 max-w-sm w-full relative overflow-hidden ring-1 ring-[#FD295E]/20">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                        <div className="relative z-10 text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                                <Trash2 className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Excluir Empresa?</h3>
                            <p className="text-gray-400 text-sm">
                                Tem certeza que deseja excluir esta empresa e todos os seus dados? <br />
                                <span className="text-red-400 font-semibold">Esta ação é irreversível.</span>
                            </p>
                        </div>

                        <div className="flex gap-3 relative z-10">
                            <button
                                onClick={() => setCompanyToDelete(null)}
                                className="flex-1 py-3 border border-white/10 rounded-lg text-gray-300 hover:bg-white/5 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-all hover:scale-[1.02]"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 lg:p-12 relative z-10 overflow-y-auto">
                <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-24 items-center">

                    {/* Left Column: Hero Brand (Logo Only) */}
                    <div className="flex flex-col items-center lg:items-start justify-center animate-in slide-in-from-left duration-700 delay-100 mb-4 lg:mb-0">
                        <div className="relative group cursor-default mb-4 lg:mb-6">
                            <div className="absolute -inset-4 bg-gradient-to-r from-[#FD295E] to-[#FF6B6B] rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000"></div>
                            <img
                                src="/logo-hub.png"
                                alt="PLIN HUB"
                                className="relative h-28 md:h-48 lg:h-80 object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-[1.02]"
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
                    <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl p-5 md:p-12 animate-in slide-in-from-right duration-700 delay-200 ring-1 ring-white/5 w-full">
                        <div className="flex justify-between items-center mb-6 lg:mb-10">
                            <div>
                                <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight">EMPRESAS:</h2>
                                <p className="text-[10px] md:text-sm text-gray-400 font-medium tracking-widest">ESCOLHA UMA OPÇÃO ABAIXO</p>
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
                                    onClick={() => handleCompanyClick(company)}
                                >
                                    <div className="flex items-center gap-3 md:gap-5">
                                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-[#FD295E] shrink-0 border border-white/5 shadow-inner group-hover:scale-105 transition-transform">
                                            {company.logo ? (
                                                <img src={company.logo} alt={company.name} className="w-full h-full object-contain rounded-xl p-2" />
                                            ) : (
                                                <Building2 className="w-6 h-6 md:w-8 md:h-8" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-white text-base md:text-lg truncate group-hover:text-[#FD295E] transition-colors">{company.name}</h3>
                                            <p className="text-[10px] md:text-xs text-gray-500 truncate font-mono tracking-wider">{company.cnpj || 'CNPJ NÃO INFORMADO'}</p>
                                        </div>
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#FD295E] group-hover:text-white transition-all transform group-hover:rotate-[-45deg] shadow-lg shadow-transparent group-hover:shadow-[#FD295E]/40">
                                            <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
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

                        {/* DEBUG FOOTER */}
                        <div className="mt-2 text-[9px] text-gray-800 font-mono text-center opacity-50 select-text">
                            ENV: {supabaseUrl.substring(0, 15)}... |
                            USER: {user ? user.id : 'NULL'} |
                            TABLE: companies
                        </div>
                    </div>
                </div>
            </div>
        </Background3D>
    );
}
