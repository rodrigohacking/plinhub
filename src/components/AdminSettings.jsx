import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, AlertCircle, CheckCircle, Play, Building, Upload, Lock, Unlock, Key, Eye, EyeOff, Users, UserPlus, Trash2, Shield } from 'lucide-react';
import { fetchPipefyDeals } from '../services/pipefy';
import { fetchMetaCampaigns } from '../services/meta';
import { getCompaniesConfig, saveCompanyConfig, getAdminPin, setAdminPin, checkAdminPin } from '../lib/storage';

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
    const [showToken, setShowToken] = useState(false); // Toggle password visibility after unlock

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

        // Wait for the DB save to complete before signaling success
        await saveCompanyConfig(config);

        setStatus('success');
        setTimeout(() => {
            setStatus('idle');
            // Trigger the refresh callback if provided (IMPORTANT for App.jsx to reload data)
            if (onSave) onSave();
        }, 1000);
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

    if (!company) {
        return (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
                <div className="bg-white dark:bg-[#111] p-12 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm text-center">
                    <Building className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Nenhuma empresa selecionada</h3>
                    <p className="text-gray-500 dark:text-gray-400">Selecione uma empresa para configurar.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12 relative">
            {/* Remove User Confirmation Modal */}
            {showRemoveModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-transparent dark:border-white/10">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Remover Acesso?
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Tem certeza que deseja remover o acesso de <span className="font-semibold text-gray-800 dark:text-gray-200">{userToRemove}</span>?
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => { setShowRemoveModal(false); setUserToRemove(null); }}
                                className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmRemoveUser}
                                className="flex-1 py-3 bg-red-600 dark:bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                            >
                                Sim, Remover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Security Modal */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-transparent dark:border-white/10">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-[#FD295E]/10 dark:bg-[#FD295E]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-8 h-8 text-[#FD295E] dark:text-[#FD295E]" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isSettingNewPin ? 'Criar PIN de Segurança' : 'Acesso Restrito'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                {isSettingNewPin
                                    ? 'Defina um PIN numérico para proteger os tokens de acesso.'
                                    : 'Digite seu PIN para visualizar ou editar os tokens.'}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <input
                                autoFocus
                                type="password"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                placeholder="Digite o PIN"
                                className="w-full text-center text-2xl tracking-[0.5em] font-bold p-3 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-gray-900 dark:text-white bg-white dark:bg-[#111]"
                                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                                maxLength={6}
                            />
                            {pinError && <p className="text-red-500 text-sm text-center font-medium">{pinError}</p>}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowPinModal(false); setPinError(''); setPinInput(''); }}
                                    className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handlePinSubmit}
                                    className="flex-1 py-3 bg-[#FD295E] text-white font-bold rounded-lg hover:bg-[#e11d48]"
                                >
                                    {isSettingNewPin ? 'Definir PIN' : 'Desbloquear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações da Empresa</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie os dados e integrações de {company.name}</p>
                </div>
                <div className="flex items-center gap-2">
                    {isLocked ? (
                        <button
                            onClick={() => setShowPinModal(true)}
                            className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                            <Lock className="w-4 h-4" /> Tokens Bloqueados
                        </button>
                    ) : (
                        <button
                            onClick={() => { setIsLocked(true); setShowToken(false); }}
                            className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                        >
                            <Unlock className="w-4 h-4" /> Tokens Liberados
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {/* Company Data */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <Building className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        Dados da Empresa
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Empresa</label>
                            <input
                                type="text"
                                name="name"
                                value={config.name}
                                onChange={handleChange}
                                className="w-full p-3 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CNPJ</label>
                            <input
                                type="text"
                                name="cnpj"
                                value={config.cnpj}
                                onChange={handleChange}
                                placeholder="00.000.000/0001-00"
                                className="w-full p-3 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Logo da Empresa</label>
                            <div className="flex items-center gap-4">
                                {config.logo && (
                                    <div className="w-20 h-20 rounded-lg border border-gray-200 dark:border-white/10 p-2 bg-gray-50 dark:bg-white/5 flex items-center justify-center shrink-0">
                                        <img src={config.logo} alt="Logo" className="max-w-full max-h-full object-contain rounded" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#FD295E]/10 dark:file:bg-[#FD295E]/20 file:text-[#FD295E] dark:file:text-[#FD295E] hover:file:bg-[#FD295E]/20 dark:hover:file:bg-[#FD295E]/30 cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Carregue uma imagem (PNG, JPG) para usar como logo.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users / Access Control */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm relative overflow-hidden">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        Gestão de Acesso
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* List Users */}
                        <div className="lg:col-span-2 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Usuários com Acesso</h3>
                            {!companyUsers || companyUsers.length === 0 ? (
                                <div className="p-8 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center">
                                    <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum usuário cadastrado.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {companyUsers.map((user, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-300">
                                                    <span className="text-xs font-bold">{user.email.substring(0, 2).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                        {user.email}
                                                        {user.status === 'pending' && (
                                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                                                Pendente
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                            user.role === 'editor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                                                            }`}>
                                                            {user.role === 'admin' ? 'Administrador' : user.role === 'editor' ? 'Colaborador' : 'Leitor'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveClick(user.email)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remover acesso"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add User Form */}
                        <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl p-5 h-fit">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-[#FD295E]" />
                                Adicionar Usuário
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">E-mail do Usuário</label>
                                    <input
                                        type="email"
                                        value={newUserEmail}
                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                        placeholder="usuario@email.com"
                                        className="w-full p-2.5 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Nível de Acesso</label>
                                    <select
                                        value={newUserRole}
                                        onChange={(e) => setNewUserRole(e.target.value)}
                                        className="w-full p-2.5 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none appearance-none"
                                    >
                                        <option value="admin">Administrador (Total)</option>
                                        <option value="editor">Colaborador (Editor)</option>
                                        <option value="viewer">Leitor (Apenas Visualização)</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddUser}
                                    className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black font-medium rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Conceder Acesso
                                </button>
                                <div className="pt-2 border-t border-gray-200 dark:border-white/5">
                                    <div className="flex gap-2 items-start text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                        <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                                        <p>Usuários terão acesso apenas aos dados desta empresa conforme o nível selecionado.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pipefy */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 sm:gap-0">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <div className="w-2 h-8 bg-[#FD295E] rounded-full"></div>
                            Integração Pipefy
                        </h2>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={testPipefy} className="text-sm text-[#FD295E] dark:text-[#FD295E] hover:text-[#e11d48] dark:hover:text-[#FD295E]/70 font-medium flex items-center gap-1">
                                <Play className="w-4 h-4" /> Testar Conexão
                            </button>
                        </div>
                    </div>

                    {isLocked && (
                        <div className="absolute inset-x-0 bottom-0 top-16 bg-white/60 dark:bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 border-t border-gray-100 dark:border-white/5">
                            <Lock className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
                            <h4 className="text-gray-800 dark:text-white font-bold">Área Protegida</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">Para visualizar ou editar tokens sensíveis, é necessário desbloquear o acesso.</p>
                            <button
                                onClick={() => setShowPinModal(true)}
                                className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <Key className="w-4 h-4" /> Inserir PIN de Acesso
                            </button>
                        </div>
                    )}

                    {testStatus.type === 'pipefy' && (
                        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${testStatus.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {testStatus.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            {testStatus.msg}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Organization ID</label>
                            <input
                                type="text"
                                name="pipefyOrgId"
                                value={config.pipefyOrgId}
                                onChange={handleChange}
                                placeholder="Ex: 300567"
                                className="w-full p-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pipe ID</label>
                            <input
                                type="text"
                                name="pipefyPipeId"
                                value={config.pipefyPipeId}
                                onChange={handleChange}
                                placeholder="Ex: 1029384"
                                className="w-full p-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2 relative">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Personal Access Token</label>
                                {!isLocked && (
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="text-xs text-[#FD295E] dark:text-[#FD295E] hover:underline flex items-center gap-1"
                                    >
                                        {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        {showToken ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                )}
                            </div>
                            <input
                                type={showToken && !isLocked ? "text" : "password"}
                                name="pipefyToken"
                                value={config.pipefyToken}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="Bearer token..."
                                className={`w-full p-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none font-mono text-black dark:text-white ${isLocked ? 'bg-gray-50 dark:bg-white/5' : 'bg-white dark:bg-[#1a1a1a]'}`}
                            />
                        </div>
                    </div>

                    {/* Manual Mapping Section */}
                    {!isLocked && (
                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                🛠️ Mapeamento de Campos (Avançado)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Group: Ganho */}
                                <div className="space-y-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Fase GANHO (Nome)</label>
                                        <input
                                            type="text"
                                            name="wonPhase"
                                            value={config.wonPhase}
                                            onChange={handleChange}
                                            placeholder="Ex: Contato Assinado"
                                            className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Fase GANHO (ID)</label>
                                        <input
                                            type="text"
                                            name="wonPhaseId"
                                            value={config.wonPhaseId || ''}
                                            onChange={handleChange}
                                            placeholder="Ex: 3045678"
                                            className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none font-mono text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                                        />
                                    </div>
                                </div>

                                {/* Group: Perdido */}
                                <div className="space-y-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Fase PERDIDO (Nome)</label>
                                        <input
                                            type="text"
                                            name="lostPhase"
                                            value={config.lostPhase}
                                            onChange={handleChange}
                                            placeholder="Ex: Perdido"
                                            className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Fase PERDIDO (ID)</label>
                                        <input
                                            type="text"
                                            name="lostPhaseId"
                                            value={config.lostPhaseId || ''}
                                            onChange={handleChange}
                                            placeholder="Ex: 338889931"
                                            className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none font-mono text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                                        />
                                    </div>
                                </div>

                                {/* Group: Qualificado - REMOVED per user request */}

                                {/* Other Fields */}
                                <div className="space-y-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Nome do Campo: Valor</label>
                                        <input
                                            type="text"
                                            name="valueField"
                                            value={config.valueField}
                                            onChange={handleChange}
                                            placeholder="Ex: Valor mensal..."
                                            className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#FD295E] outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Nome do Campo: Motivo Perda</label>
                                        <input
                                            type="text"
                                            name="lossReasonField"
                                            value={config.lossReasonField}
                                            onChange={handleChange}
                                            placeholder="Ex: Motivo da perda"
                                            className="w-full p-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Meta Ads */}
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 sm:gap-0">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <div className="w-2 h-8 bg-blue-400 rounded-full"></div>
                            Integração Meta Ads
                        </h2>
                        <button onClick={testMeta} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1">
                            <Play className="w-4 h-4" /> Testar Conexão
                        </button>
                    </div>

                    {/* FORCE SYNC BUTTON (New) */}
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            <strong className="text-gray-900 dark:text-white block mb-1">Sincronização Nuvem</strong>
                            Se os dados não aparecem no celular, clique aqui para forçar o envio.
                        </div>
                        <button
                            onClick={forceSync}
                            className="whitespace-nowrap bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-black dark:hover:bg-gray-200 flex items-center gap-2 transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            Forçar Envio Agora
                        </button>
                    </div>

                    {testStatus.type === 'sync' && (
                        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${testStatus.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {testStatus.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            {testStatus.msg}
                        </div>
                    )}

                    {isLocked && (
                        <div className="absolute inset-x-0 bottom-0 top-16 bg-white/60 dark:bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 border-t border-gray-100 dark:border-white/5">
                            <Lock className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
                            <h4 className="text-gray-800 dark:text-white font-bold">Área Protegida</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">Para visualizar ou editar tokens sensíveis, é necessário desbloquear o acesso.</p>
                            <button
                                onClick={() => setShowPinModal(true)}
                                className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <Key className="w-4 h-4" /> Inserir PIN de Acesso
                            </button>
                        </div>
                    )}

                    {testStatus.type === 'meta' && (
                        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${testStatus.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {testStatus.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            {testStatus.msg}
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ad Account ID</label>
                            <input
                                type="text"
                                name="metaAdAccountId"
                                value={config.metaAdAccountId}
                                onChange={handleChange}
                                placeholder="Ex: act_123456789"
                                className="w-full p-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black dark:text-white bg-white dark:bg-[#1a1a1a]"
                            />
                        </div>
                        <div className="space-y-2 relative">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Access Token</label>
                                {!isLocked && (
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        {showToken ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                )}
                            </div>
                            <input
                                type={showToken && !isLocked ? "text" : "password"}
                                name="metaToken"
                                value={config.metaToken}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="EAAB..."
                                className={`w-full p-2 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-black dark:text-white ${isLocked ? 'bg-gray-50 dark:bg-white/5' : 'bg-white dark:bg-[#1a1a1a]'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                        {status === 'saving' ? 'Salvando...' : status === 'success' ? 'Salvo!' : 'Salvar Configurações'}
                        {status === 'success' ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
