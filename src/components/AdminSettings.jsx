import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, AlertCircle, CheckCircle, Play, Building, Upload, Lock, Unlock, Key, Eye, EyeOff, Users, UserPlus, Trash2, Shield } from 'lucide-react';
import { fetchPipefyDeals, getPipeDetails } from '../services/pipefy';
import { fetchMetaCampaigns } from '../services/meta';
import { getCompaniesConfig, saveCompanyConfig, getAdminPin, setAdminPin, checkAdminPin } from '../lib/storage';

// Helper Component for Multi-Select
const PhaseMultiSelect = ({ label, type, selectedIds, phases, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedList = phases.filter(p => selectedIds.includes(String(p.id)));

    return (
        <div className="relative" ref={containerRef}>
            <label className={`text-xs font-bold uppercase mb-1 block ${type === 'won' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {label}
            </label>

            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#1a1a1a] cursor-pointer flex justify-between items-center min-h-[38px]"
            >
                <div className="flex flex-wrap gap-1">
                    {selectedList.length === 0 && <span className="text-gray-400">Selecione as fases...</span>}
                    {selectedList.map(p => (
                        <span key={p.id} className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${type === 'won' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {p.name}
                            <div
                                onClick={(e) => { e.stopPropagation(); onSelect(String(p.id)); }}
                                className="cursor-pointer hover:font-bold"
                            >×</div>
                        </span>
                    ))}
                </div>
                <div className="text-gray-400 text-xs">▼</div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {phases.map(p => {
                        const isSelected = selectedIds.includes(String(p.id));
                        return (
                            <div
                                key={p.id}
                                onClick={() => onSelect(String(p.id))}
                                className={`p-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-[#FD295E] border-[#FD295E]' : 'border-gray-300'}`}>
                                    {isSelected && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="text-gray-700 dark:text-gray-200">{p.name}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export function AdminSettings({ company, onSave }) {
    const [config, setConfig] = useState({
        id: null,
        name: '',
        cnpj: '',
        logo: '',
        pipefyOrgId: '',
        pipefyPipeId: '',
        pipefyToken: '',
        wonPhase: '',
        wonPhaseId: '',
        lostPhase: '',
        lostPhaseId: '',
        qualifiedPhase: '',
        qualifiedPhaseId: '',
        valueField: '',
        lossReasonField: '',
        metaAdAccountId: '',
        metaToken: '',
        // users: [] REMOVED from config state to avoid overwrite issues
    });
    const [companyUsers, setCompanyUsers] = useState([]); // Separate state for DB users

    const [status, setStatus] = useState('idle');
    const [testStatus, setTestStatus] = useState({ type: '', msg: '', error: false });

    // User Management State
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('editor');

    // Security State
    const [isLocked, setIsLocked] = useState(true);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [isSettingNewPin, setIsSettingNewPin] = useState(false);
    const [newPin, setNewPin] = useState(''); // Added missing state
    const [showToken, setShowToken] = useState(false); // Toggle password visibility after unlock

    // Pipefy Auto-Config State
    const [pipeDetails, setPipeDetails] = useState({ phases: [], fields: [], loaded: false });
    const [loadingPipeDetails, setLoadingPipeDetails] = useState(false);

    useEffect(() => {
        if (company) {

            // Load company config and users
            const loadData = async () => {
                try {
                    // 1. Sync Company to DB (Ensure it exists)
                    // If the company was created in localStorage but not in DB, we must create it now.
                    try {
                        await fetch(`/api/companies`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: company.id,
                                name: company.name,
                                cnpj: company.cnpj || '',
                                logo: company.logo || ''
                            })
                        });
                    } catch (syncErr) {
                        console.error("Failed to sync company to DB:", syncErr);
                        // Don't block, as it might already exist or be a network temporary issue
                    }

                    // 2. Fetch Users from DB
                    try {
                        const usersRes = await fetch(`/api/companies/${company.id}/users`);
                        if (usersRes.ok) {
                            const dbUsers = await usersRes.json();
                            setCompanyUsers(dbUsers); // Set separate state
                        }
                    } catch (err) {
                        console.error("Failed to fetch users from DB:", err);
                        if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
                            toast.error("Backend offline. Rode 'npm run dev' na pasta backend.");
                        } else {
                            toast.error("Erro ao carregar usuários.");
                        }
                    }

                    // Load config directly from the 'company' prop (which is enriched with DB data by getData)
                    // We no longer rely on 'getCompaniesConfig()' (localStorage) as the source of truth for these fields.
                    setConfig(prev => ({
                        ...prev,
                        id: company.id,
                        name: company.name,
                        cnpj: company.cnpj || '',
                        logo: company.logo || '',
                        // Integration fields now come flattened from the backend/getData
                        pipefyOrgId: company.pipefyOrgId || '',
                        pipefyPipeId: company.pipefyPipeId || '',
                        pipefyToken: company.pipefyToken || '',
                        wonPhase: company.wonPhase || '',
                        wonPhaseId: company.wonPhaseId || '',
                        lostPhase: company.lostPhase || '',
                        lostPhaseId: company.lostPhaseId || '',
                        qualifiedPhase: company.qualifiedPhase || '',
                        qualifiedPhaseId: company.qualifiedPhaseId || '',
                        valueField: company.valueField || '',
                        lossReasonField: company.lossReasonField || '',
                        metaAdAccountId: company.metaAdAccountId || '',
                        metaToken: company.metaToken || '',
                    }));

                } catch (e) {
                    console.error("Error loading settings:", e);
                }
            };
            loadData();


            // Look for existing PIN to determine if we are in "Create" or "Verify" mode initially
            const hasPin = !!getAdminPin();
            setIsSettingNewPin(!hasPin);
            setIsLocked(true);
        }
    }, [company]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig(prev => ({ ...prev, logo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };


    const handleAddUser = async () => {
        if (!newUserEmail || !newUserEmail.includes('@')) {
            toast.error('Por favor, insira um e-mail válido.');
            return;
        }

        try {
            // 1. Add to DB (Persistence)
            const saveRes = await fetch(`/api/companies/${config.id}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail.trim(),
                    role: newUserRole
                })
            });

            if (!saveRes.ok) throw new Error('Failed to save user to DB');
            const savedUser = await saveRes.json();

            // 2. Send Invite Email (Simulated)
            const inviteRes = await fetch('/api/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail.trim(),
                    companyId: config.id,
                    role: newUserRole,
                    companyName: config.name
                })
            });

            if (inviteRes.ok) {
                toast.success(`Convite enviado para ${newUserEmail}`);
            } else {
                toast.warning('Convite não enviado (Backend offline), mas acesso foi salvo.');
            }

            // Update separate state with the REAL saved user from DB
            setCompanyUsers(prev => [...prev, savedUser]);
            setNewUserEmail('');

        } catch (error) {
            console.error('Error adding user:', error);
            toast.warning('Erro ao salvar usuário. Verifique a conexão.');
        }
    };

    const [userToRemove, setUserToRemove] = useState(null); // State for modal
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    const handleRemoveClick = (email) => {
        setUserToRemove(email);
        setShowRemoveModal(true);
    };

    const confirmRemoveUser = async () => {
        if (!userToRemove) return;

        try {
            // Remove from DB
            await fetch(`/api/companies/${config.id}/users/${userToRemove}`, {
                method: 'DELETE'
            });

            setCompanyUsers(prev => prev.filter(u => u.email !== userToRemove));
            toast.success("Usuário removido.");
        } catch (err) {
            console.error("Error removing user:", err);
            toast.error("Erro ao remover usuário.");
        } finally {
            setShowRemoveModal(false);
            setUserToRemove(null);
        }
    };

    const handleSave = async () => {
        if (!config.name) {
            alert('Por favor, preencha o nome da empresa.');
            return;
        }

        setStatus('saving');

        try {
            // Wait for the DB save to complete before signaling success
            const savedCompany = await saveCompanyConfig(config);

            // CRITICAL: Update local ID to ensure subsequent saves are UPDATES (PUT), not CREATES (POST)
            if (savedCompany && savedCompany.id) {
                setConfig(prev => ({ ...prev, id: savedCompany.id }));
            }

            setStatus('success');
            setTimeout(() => {
                setStatus('idle');
                // Trigger the refresh callback if provided (IMPORTANT for App.jsx to reload data)
                if (onSave) onSave();
            }, 1000);
        } catch (error) {
            console.error("Save error:", error);
            setStatus('idle'); // Reset status so button works again
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    };

    const handlePinSubmit = () => {
        if (isSettingNewPin) {
            if (pinInput.length < 4) {
                setPinError('O PIN deve ter pelo menos 4 dígitos.');
                return;
            }
            setAdminPin(pinInput);
            setIsSettingNewPin(false);
            setIsLocked(false);
            setShowPinModal(false);
            setPinInput('');
            alert('PIN de segurança criado com sucesso!');
        } else {
            if (checkAdminPin(pinInput)) {
                setIsLocked(false);
                setShowPinModal(false);
                setPinInput('');
                setPinError('');
            } else {
                setPinError('PIN incorreto. Tente novamente.');
            }
        }
    };

    const testPipefy = async () => {
        setTestStatus({ type: 'pipefy', msg: 'Testando conexão...', error: false });
        try {
            const result = await fetchPipefyDeals(config.pipefyOrgId, config.pipefyPipeId, config.pipefyToken);
            // Result can be an array (legacy) or object with { deals, debug }
            const deals = Array.isArray(result) ? result : (result.deals || []);
            const debug = !Array.isArray(result) ? result.debug : null;

            if (deals.length > 0) {
                setTestStatus({ type: 'pipefy', msg: `Sucesso! Encontramos ${deals.length} cards.`, error: false });
            } else {
                let msg = 'Conexão OK, mas nenhum card encontrado.';
                if (debug) {
                    msg += ` (Fases: ${debug.phasesFound}, Cards Raw: ${debug.totalRaw})`;
                    if (debug.phasesFound > 0 && debug.totalRaw === 0) msg += ' O Pipe parece estar vazio.';
                }
                setTestStatus({ type: 'pipefy', msg: msg, error: true });
            }
        } catch (e) {
            setTestStatus({ type: 'pipefy', msg: `Erro: ${e.message}`, error: true });
        }
    };

    const testMeta = async () => {
        setTestStatus({ type: 'meta', msg: 'Testando conexão...', error: false });
        try {
            const camps = await fetchMetaCampaigns(config.metaAdAccountId, config.metaToken);
            if (camps.length > 0) {
                setTestStatus({ type: 'meta', msg: `Sucesso! Encontramos ${camps.length} campanhas.`, error: false });
            } else {
                setTestStatus({ type: 'meta', msg: 'Conexão OK, mas nenhuma campanha encontrada.', error: true });
            }
        } catch (e) {
            setTestStatus({ type: 'meta', msg: `Erro: ${e.message}`, error: true });
        }
    };

    const forceSync = async () => {
        if (!config.id) return;
        setTestStatus({ type: 'sync', msg: 'Sincronizando dados para a nuvem...', error: false });
        try {
            await saveCompanyConfig(config);
            setTestStatus({ type: 'sync', msg: 'Sucesso! Dados enviados para o banco de dados.', error: false });
            toast.success("Dados sincronizados com a nuvem!");
        } catch (e) {
            console.error("Sync error:", e);
            setTestStatus({ type: 'sync', msg: 'Erro ao sincronizar. Verifique o console.', error: true });
            toast.error("Erro na sincronização.");
        }
    };

    const loadPipeDetails = async () => {
        if (!config.pipefyPipeId || !config.pipefyToken) {
            toast.error("Preencha o Pipe ID e o Token antes de carregar.");
            return;
        }

        setLoadingPipeDetails(true);
        try {
            const details = await getPipeDetails(config.pipefyPipeId, config.pipefyToken);
            setPipeDetails({ ...details, loaded: true });
            toast.success("Fases e Campos carregados com sucesso!");

            // Auto-Match logic (Heuristic) if fields are empty
            setConfig(prev => {
                const updates = {};

                // Won Phase Match
                if (!prev.wonPhaseId) {
                    const won = details.phases.find(p => {
                        const n = p.name.toLowerCase();
                        return n.includes('ganho') || n.includes('won') || n.includes('vendido') || n.includes('fechado') || n.includes('contrato');
                    });
                    if (won) {
                        updates.wonPhase = won.name;
                        updates.wonPhaseId = won.id;
                    }
                }

                // Lost Phase Match
                if (!prev.lostPhaseId) {
                    const lost = details.phases.find(p => {
                        const n = p.name.toLowerCase();
                        return n.includes('perdido') || n.includes('lost') || n.includes('cancelado');
                    });
                    if (lost) {
                        updates.lostPhase = lost.name;
                        updates.lostPhaseId = lost.id;
                    }
                }

                return { ...prev, ...updates };
            });

        } catch (error) {
            console.error(error);
            toast.error(`Erro ao carregar pipe: ${error.message}`);
        } finally {
            setLoadingPipeDetails(false);
        }
    };

    const handlePhaseSelect = (type, selectedId) => {
        const toggleId = (currentIds, id) => {
            const list = (currentIds || '').split(',').map(s => s.trim()).filter(Boolean);
            if (list.includes(id)) {
                return list.filter(l => l !== id).join(',');
            } else {
                return [...list, id].join(',');
            }
        };

        if (type === 'won') {
            setConfig(prev => {
                const newIds = toggleId(prev.wonPhaseId, selectedId);
                const phase = pipeDetails.phases.find(p => String(p.id) === String(selectedId));
                return {
                    ...prev,
                    wonPhaseId: newIds,
                    wonPhase: phase ? phase.name : prev.wonPhase // Fallback name
                };
            });
        } else if (type === 'lost') {
            setConfig(prev => {
                const newIds = toggleId(prev.lostPhaseId, selectedId);
                const phase = pipeDetails.phases.find(p => String(p.id) === String(selectedId));
                return {
                    ...prev,
                    lostPhaseId: newIds,
                    lostPhase: phase ? phase.name : prev.lostPhase
                };
            });
        }
    };

    // Helper for Glass Cards
    const GlassCard = ({ children, className = '' }) => (
        <div className={`bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-gray-200/50 dark:shadow-black/50 overflow-hidden ${className}`}>
            {children}
        </div>
    );

    const SectionHeader = ({ icon: Icon, title, color = "text-gray-900" }) => (
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-white/5 ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
    );

    const handleNewPinSave = () => {
        if (newPin.length < 4) return;
        setAdminPin(newPin);
        setIsSettingNewPin(false);
        setNewPin('');
        setIsLocked(false);
        toast.success("PIN definido com sucesso!");
    };

    if (!company) {
        return (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
                <GlassCard className="p-12 text-center">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Building className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Selecione uma Organização</h2>
                    <p className="text-gray-500 max-w-md mx-auto">Para acessar as configurações, selecione primeiro uma organização no menu principal.</p>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32 relative font-sans">

            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FD295E]/10 text-[#FD295E] text-xs font-bold uppercase tracking-wider mb-3">
                        Configurações
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {company.name}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Gerencie dados, acessos e integrações da sua organização.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSettingNewPin(!isSettingNewPin)}
                        className="px-5 py-3 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <Key className="w-4 h-4" /> {isSettingNewPin ? 'Cancelar' : 'Alterar PIN'}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className={`px-6 py-3 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg shadow-[#FD295E]/30 transition-all transform hover:-translate-y-0.5 ${status === 'saving' ? 'bg-[#FD295E]/70 cursor-wait' : 'bg-[#FD295E] hover:bg-[#e11d48]'}`}
                    >
                        {status === 'saving' ? <>Salvando... <Save className="w-4 h-4 animate-bounce" /></> : status === 'success' ? <>Salvo! <CheckCircle className="w-4 h-4" /></> : <>Salvar Alterações <Save className="w-4 h-4" /></>}
                    </button>
                </div>
            </div>

            {/* PIN Reset Panel */}
            {isSettingNewPin && (
                <div className="mb-10 p-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl shadow-xl animate-in slide-in-from-top-4">
                    <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-[22px]">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <Shield className="w-6 h-6 text-yellow-500" />
                                    Redefinir PIN de Segurança
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">Este PIN é usado para proteger chaves de API e configurações sensíveis.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-40 p-4 bg-gray-50 dark:bg-black/20 border-2 border-gray-100 dark:border-white/10 rounded-2xl outline-none focus:border-yellow-500 font-mono text-2xl text-center tracking-[0.5em] font-bold text-gray-900 dark:text-white transition-colors placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
                                    placeholder="000000"
                                />
                                <button
                                    onClick={handleNewPinSave}
                                    disabled={newPin.length < 4}
                                    className="px-6 py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30"
                                >
                                    Gravar Novo PIN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Organization & Access */}
                <div className="lg:col-span-4 space-y-8">

                    {/* Company Data */}
                    <GlassCard className="p-6">
                        <SectionHeader icon={Building} title="Dados da Organização" />
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Nome da Organização</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={config.name}
                                    onChange={handleChange}
                                    className="w-full p-4 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-[#FD295E] transition-all font-medium text-lg"
                                    placeholder="Ex: Minha Empresa"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Logo da Marca</label>
                                <div className="group relative w-full h-40 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-[#FD295E] transition-all bg-gray-50 dark:bg-black/20 overflow-hidden flex flex-col items-center justify-center cursor-pointer">
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />

                                    {config.logo ? (
                                        <div className="relative w-full h-full p-4 flex items-center justify-center bg-white dark:bg-[#111]">
                                            <img src={config.logo} alt="Logo" className="max-h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium backdrop-blur-sm">
                                                Trocar Logo
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-4">
                                            <div className="w-10 h-10 bg-[#FD295E]/10 rounded-full flex items-center justify-center mx-auto mb-2 text-[#FD295E]">
                                                <Upload className="w-5 h-5" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Clique para enviar</p>
                                            <p className="text-xs text-gray-400 mt-1">PNG, JPG (Max 2MB)</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Access Management */}
                    <GlassCard className="p-6">
                        <SectionHeader icon={Users} title="Gestão de Acesso" />

                        {/* Add User */}
                        <div className="flex gap-2 mb-6">
                            <input
                                type="email"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                placeholder="E-mail do novo usuário..."
                                className="flex-1 p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-[#FD295E] text-sm"
                            />
                            <button onClick={handleAddUser} className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-xl hover:opacity-80 transition-opacity">
                                <UserPlus className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {companyUsers.map((user, idx) => (
                                <div key={idx} className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 shadow-inner">
                                            {user.email.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate w-32 md:w-40">{user.email}</p>
                                            <p className="text-[10px] uppercase font-bold text-gray-400">{user.role}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveClick(user.email)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {companyUsers.length === 0 && (
                                <p className="text-center text-sm text-gray-400 py-4 italic">Nenhum usuário adicional.</p>
                            )}
                        </div>
                    </GlassCard>
                </div>

                {/* Right Column: Integrations */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Pipefy Integration */}
                    <GlassCard className="border-l-4 border-l-[#FD295E]">
                        <div className="p-8">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#0065FF]/10 text-[#0065FF] rounded-2xl flex items-center justify-center">
                                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-8h2v8z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Integração Pipefy</h2>
                                        <p className="text-sm text-gray-500">Conecte seu fluxo de vendas para automação de métricas.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={loadPipeDetails} disabled={loadingPipeDetails} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                                        {loadingPipeDetails ? <span className="animate-spin">⏳</span> : <Upload className="w-3 h-3" />} {pipeDetails.loaded ? 'Recarregar' : 'Carregar Pipe'}
                                    </button>
                                    <button onClick={testPipefy} className="px-4 py-2 bg-[#0065FF]/10 text-[#0065FF] rounded-lg hover:bg-[#0065FF]/20 font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                                        <Play className="w-3 h-3" /> Testar
                                    </button>
                                </div>
                            </div>

                            {/* Test Status Feedback - RESTORED */}
                            {testStatus && testStatus.type === 'pipefy' && (
                                <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${testStatus.error ? 'bg-red-50 text-red-700 dark:bg-red-900/20' : 'bg-green-50 text-green-700 dark:bg-green-900/20'}`}>
                                    {testStatus.error ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                    {testStatus.msg}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Org ID</label>
                                    <input type="text" name="pipefyOrgId" value={config.pipefyOrgId} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-[#0065FF]" placeholder="Ex: 123456" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Pipe ID</label>
                                    <input type="text" name="pipefyPipeId" value={config.pipefyPipeId} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-[#0065FF]" placeholder="Ex: 789012" />
                                </div>
                            </div>

                            <div className="space-y-2 relative group">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Access Token</label>
                                <div className="relative">
                                    <input type={showToken ? "text" : "password"} name="pipefyToken" value={config.pipefyToken} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-[#0065FF] font-mono text-xs pr-10" placeholder="Insira seu token de API" />
                                    <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">{showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                                </div>
                            </div>
                        </div>

                        {/* ADVANCED MAPPING AREA */}
                        <div className="relative border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 p-8">

                            {!isLocked ? (
                                <div className="space-y-8 animate-in mt-2 fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="h-px bg-gray-200 dark:bg-white/10 flex-1"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mapeamento Avançado</span>
                                        <div className="h-px bg-gray-200 dark:bg-white/10 flex-1"></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            {pipeDetails.loaded ? (
                                                <PhaseMultiSelect label="Fase GANHO" type="won" selectedIds={(config.wonPhaseId || '').split(',')} phases={pipeDetails.phases} onSelect={(id) => handlePhaseSelect('won', id)} />
                                            ) : (
                                                <div className="opacity-50 pointer-events-none filter blur-[1px]">
                                                    <label className="text-xs font-bold text-green-600 mb-1 block">Fase GANHO</label>
                                                    <div className="p-3 border rounded-xl bg-white dark:bg-white/5 text-sm">Carregue o Pipe primeiro...</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            {pipeDetails.loaded ? (
                                                <PhaseMultiSelect label="Fase PERDIDO" type="lost" selectedIds={(config.lostPhaseId || '').split(',')} phases={pipeDetails.phases} onSelect={(id) => handlePhaseSelect('lost', id)} />
                                            ) : (
                                                <div className="opacity-50 pointer-events-none filter blur-[1px]">
                                                    <label className="text-xs font-bold text-red-600 mb-1 block">Fase PERDIDO</label>
                                                    <div className="p-3 border rounded-xl bg-white dark:bg-white/5 text-sm">Carregue o Pipe primeiro...</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Campo Valor</label>
                                            {pipeDetails.loaded ?
                                                <select name="valueField" value={config.valueField || ''} onChange={handleChange} className="w-full p-2.5 bg-gray-50 dark:bg-black/20 border border-transparent hover:border-gray-200 dark:hover:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0065FF]">
                                                    <option value="">✨ Automático (Inteligente)</option>
                                                    {pipeDetails.fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                                                    <option value="__custom__">✏️ Manual</option>
                                                </select>
                                                : <input disabled type="text" className="w-full p-2.5 bg-gray-100 dark:bg-white/5 rounded-lg text-sm cursor-not-allowed" placeholder="Aguardando Pipe..." />
                                            }
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Motivo Perda</label>
                                            {pipeDetails.loaded ?
                                                <select name="lossReasonField" value={config.lossReasonField || ''} onChange={handleChange} className="w-full p-2.5 bg-gray-50 dark:bg-black/20 border border-transparent hover:border-gray-200 dark:hover:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0065FF]">
                                                    <option value="">✨ Automático (Inteligente)</option>
                                                    {pipeDetails.fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                                                    <option value="__custom__">✏️ Manual</option>
                                                </select>
                                                : <input disabled type="text" className="w-full p-2.5 bg-gray-100 dark:bg-white/5 rounded-lg text-sm cursor-not-allowed" placeholder="Aguardando Pipe..." />
                                            }
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md z-10 flex flex-col items-center justify-center text-center p-8 transition-all duration-500">
                                    <div className="w-16 h-16 bg-white dark:bg-[#222] rounded-full shadow-2xl flex items-center justify-center mb-4 ring-4 ring-gray-50 dark:ring-white/5">
                                        <Lock className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configurações Avançadas Protegidas</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">Para evitar quebras de sistema, o mapeamento de campos está bloqueado.</p>
                                    <button onClick={() => setShowPinModal(true)} className="px-6 py-3 bg-[#FD295E] hover:bg-[#e11d48] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#FD295E]/20 hover:scale-105 transition-all">
                                        <Unlock className="w-4 h-4" /> Desbloquear
                                    </button>
                                </div>
                            )}

                            {/* Fake Background Content for Blur Effect */}
                            {isLocked && (
                                <div className="opacity-30 pointer-events-none filter blur-sm select-none" aria-hidden="true">
                                    <div className="grid grid-cols-2 gap-8 mb-6">
                                        <div className="h-20 bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                                        <div className="h-20 bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                                    </div>
                                    <div className="h-32 bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                                </div>
                            )}

                        </div>
                    </GlassCard>

                    {/* Meta Ads Integration */}
                    <GlassCard className="border-l-4 border-l-blue-500">
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <SectionHeader icon={() => <div className="w-5 h-5 bg-blue-500 rounded-full" />} title="Integração Meta Ads" color="text-blue-500 bg-blue-50" />
                                <button onClick={testMeta} className="text-blue-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"><Play className="w-3 h-3" /> Testar Conexão</button>
                            </div>

                            {/* Meta Test Result */}
                            {testStatus && testStatus.type === 'meta' && (
                                <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${testStatus.error ? 'bg-red-50 text-red-700 dark:bg-red-900/20' : 'bg-green-50 text-green-700 dark:bg-green-900/20'}`}>
                                    {testStatus.error ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                    {testStatus.msg}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Ad Account ID</label>
                                    <input type="text" name="metaAdAccountId" value={config.metaAdAccountId} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Access Token</label>
                                    <input type="password" name="metaToken" value={config.metaToken} onChange={handleChange} className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                </div>
            </div>

            {/* Modals remain mostly same but slightly cleaner */}
            {/* Remove User Modal */}
            {showRemoveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-white/20">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="w-10 h-10 text-red-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Remover Acesso?</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                                O usuário <span className="font-bold text-gray-900 dark:text-white">{userToRemove}</span> perderá acesso imediato.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setShowRemoveModal(false); setUserToRemove(null); }} className="py-4 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-colors">Cancelar</button>
                            <button onClick={confirmRemoveUser} className="py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95">Sim, Remover</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Security PIN Modal */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-10 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-white/20">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-[#FD295E]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
                                <Lock className="w-8 h-8 text-[#FD295E]" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Restrito</h3>
                            <p className="text-gray-500 text-sm mt-2">Área protegida para administradores.</p>
                        </div>
                        <div className="space-y-6">
                            <input autoFocus type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="• • • • • •" className="w-full text-center text-4xl tracking-widest font-bold p-4 bg-transparent border-b-2 border-gray-200 dark:border-white/10 outline-none focus:border-[#FD295E] text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 transition-colors" onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()} maxLength={6} />
                            {pinError && <p className="text-red-500 text-sm text-center font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{pinError}</p>}
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => { setShowPinModal(false); setPinError(''); setPinInput(''); }} className="py-3 text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">Voltar</button>
                                <button onClick={handlePinSubmit} className="py-3 bg-[#FD295E] text-white font-bold rounded-xl hover:bg-[#e11d48] shadow-lg shadow-[#FD295E]/30 transition-all hover:scale-105">Desbloquear</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
