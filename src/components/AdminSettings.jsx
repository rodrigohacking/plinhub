import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Building, Save, Trash2, CheckCircle, AlertCircle, Upload, Play, X, Users, UserPlus, ServerIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { PipeFinder } from './PipeFinder';
import { GlassCard } from './GlassCard';
import { SectionHeader } from './SectionHeader';
import { getPipeDetails } from '../services/pipefy';
import { saveCompanyConfig } from '../lib/storage';

// Helper Component for Multi-Select
const PhaseMultiSelect = ({ label, type, selectedIds, phases, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef(null);

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
            <label className={`text-xs font-bold uppercase mb-1 block ${type === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                {label}
            </label>

            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface-raised)] cursor-pointer flex justify-between items-center min-h-[38px]"
            >
                <div className="flex flex-wrap gap-1">
                    {selectedList.length === 0 && <span className="text-[var(--text-muted)]">Selecione as fases...</span>}
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
                <div className="text-[var(--text-muted)] text-xs">▼</div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {phases.map(p => {
                        const isSelected = selectedIds.includes(String(p.id));
                        return (
                            <div
                                key={p.id}
                                onClick={() => { onSelect(String(p.id)); }}
                                className={`p-3 cursor-pointer hover:bg-[var(--surface-hover)] flex items-center justify-between text-sm ${isSelected ? 'font-bold' : ''}`}
                            >
                                <span>{p.name}</span>
                                {isSelected && <CheckCircle className="w-4 h-4 text-green-500" />}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Token status badge — shows that tokens are managed server-side
const ServerTokenBadge = () => (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-semibold text-green-400">
        <ServerIcon className="w-3.5 h-3.5" />
        Token ativo no servidor
    </div>
);

export function AdminSettings({ company, onSave, onDelete, allCompanies = [], onCompanyChange }) {
    const [config, setConfig] = useState({
        id: null,
        name: '',
        cnpj: '',
        logo: '',
        pipefyOrgId: '',
        pipefyPipeId: '',
        wonPhase: '',
        wonPhaseId: '',
        lostPhase: '',
        lostPhaseId: '',
        qualifiedPhase: '',
        qualifiedPhaseId: '',
        valueField: '',
        lossReasonField: '',
        metaAdAccountId: '',
    });

    const [companyUsers, setCompanyUsers] = useState([]);
    const [status, setStatus] = useState('idle');
    const [testStatus, setTestStatus] = useState({ type: '', msg: '', error: false });

    // User management
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole] = useState('editor');
    const [userToRemove, setUserToRemove] = useState(null);
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    // Delete company
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Pipefy pipe details (phases + fields)
    const [pipeDetails, setPipeDetails] = useState({ phases: [], fields: [], loaded: false });
    const [loadingPipeDetails, setLoadingPipeDetails] = useState(false);

    // Load company data on mount / company change
    useEffect(() => {
        if (!company) return;

        const loadData = async () => {
            try {
                // Sync company to DB if needed
                try {
                    await fetch(`/api/companies`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: company.id, name: company.name, cnpj: company.cnpj || '', logo: company.logo || '' })
                    });
                } catch (_) { /* already exists, ignore */ }

                // Fetch users
                try {
                    const usersRes = await fetch(`/api/companies/${company.id}/users`);
                    if (usersRes.ok) setCompanyUsers(await usersRes.json());
                } catch (err) {
                    console.error("Failed to fetch users:", err);
                }

                // Set config from company prop
                setConfig(prev => ({
                    ...prev,
                    id: company.id,
                    name: company.name,
                    cnpj: company.cnpj || '',
                    logo: company.logo || '',
                    pipefyOrgId: company.pipefyOrgId || '',
                    pipefyPipeId: company.pipefyPipeId || '',
                    wonPhase: company.wonPhase || '',
                    wonPhaseId: company.wonPhaseId || '',
                    lostPhase: company.lostPhase || '',
                    lostPhaseId: company.lostPhaseId || '',
                    qualifiedPhase: company.qualifiedPhase || '',
                    qualifiedPhaseId: company.qualifiedPhaseId || '',
                    valueField: company.valueField || '',
                    lossReasonField: company.lossReasonField || '',
                    metaAdAccountId: company.metaAdAccountId || '',
                }));

            } catch (e) {
                console.error("Error loading settings:", e);
            }
        };

        loadData();
    }, [company]);

    // Auto-load pipe details when Pipe ID is available
    useEffect(() => {
        const pipeId = company?.pipefyPipeId;
        if (pipeId && !pipeDetails.loaded && !loadingPipeDetails) {
            loadPipeDetails(pipeId);
        }
    }, [company?.pipefyPipeId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setConfig(prev => ({ ...prev, logo: reader.result }));
            reader.readAsDataURL(file);
        }
    };

    const loadPipeDetails = async (pipeIdOverride) => {
        const pipeId = pipeIdOverride || config.pipefyPipeId;
        if (!pipeId) {
            toast.error("Preencha o Pipe ID antes de carregar.");
            return;
        }
        setLoadingPipeDetails(true);
        try {
            // Token is handled by the backend proxy via PIPEFY_TOKEN env var
            const details = await getPipeDetails(pipeId, null);
            setPipeDetails({ ...details, loaded: true });

            // Auto-match phases by name
            setConfig(prev => {
                const updates = {};
                if (!prev.wonPhaseId) {
                    const won = details.phases.find(p => {
                        const n = p.name.toLowerCase();
                        return n.includes('ganho') || n.includes('won') || n.includes('vendido') || n.includes('fechado') || n.includes('contrato');
                    });
                    if (won) { updates.wonPhase = won.name; updates.wonPhaseId = won.id; }
                }
                if (!prev.lostPhaseId) {
                    const lost = details.phases.find(p => {
                        const n = p.name.toLowerCase();
                        return n.includes('perdido') || n.includes('lost') || n.includes('cancelado');
                    });
                    if (lost) { updates.lostPhase = lost.name; updates.lostPhaseId = lost.id; }
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
            if (list.includes(id)) return list.filter(l => l !== id).join(',');
            return [...list, id].join(',');
        };
        if (type === 'won') {
            setConfig(prev => {
                const newIds = toggleId(prev.wonPhaseId, selectedId);
                const phase = pipeDetails.phases.find(p => String(p.id) === String(selectedId));
                return { ...prev, wonPhaseId: newIds, wonPhase: phase ? phase.name : prev.wonPhase };
            });
        } else if (type === 'lost') {
            setConfig(prev => {
                const newIds = toggleId(prev.lostPhaseId, selectedId);
                const phase = pipeDetails.phases.find(p => String(p.id) === String(selectedId));
                return { ...prev, lostPhaseId: newIds, lostPhase: phase ? phase.name : prev.lostPhase };
            });
        }
    };

    const handleAddUser = async () => {
        if (!newUserEmail || !newUserEmail.includes('@')) {
            toast.error('Por favor, insira um e-mail válido.');
            return;
        }
        try {
            // Single call to /api/invites — saves to DB + sends Supabase auth invite email
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

            const inviteData = await inviteRes.json();

            if (!inviteRes.ok) throw new Error(inviteData.error || 'Erro ao convidar usuário');

            if (inviteData.warning) {
                toast.warning(inviteData.message || 'Acesso salvo. Verifique o e-mail.');
            } else {
                toast.success(inviteData.message || `Convite enviado para ${newUserEmail}`);
            }

            // Add to local list
            setCompanyUsers(prev => [...prev, { companyId: config.id, email: newUserEmail.trim(), role: newUserRole }]);
            setNewUserEmail('');
        } catch (error) {
            console.error('Error adding user:', error);
            toast.error(`Erro ao convidar: ${error.message}`);
        }
    };

    const handleRemoveClick = (email) => {
        setUserToRemove(email);
        setShowRemoveModal(true);
    };

    const confirmRemoveUser = async () => {
        if (!userToRemove) return;
        try {
            await fetch(`/api/companies/${config.id}/users/${userToRemove}`, { method: 'DELETE' });
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
            const savedCompany = await saveCompanyConfig(config);
            if (savedCompany?.id) setConfig(prev => ({ ...prev, id: savedCompany.id }));
            setStatus('success');
            toast.success("Configurações salvas com sucesso!");
            setTimeout(() => {
                setStatus('idle');
                if (onSave) onSave();
            }, 1000);
        } catch (error) {
            console.error("Save error:", error);
            setStatus('idle');
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    };

    const handleDeleteCompany = async () => {
        if (deleteConfirmName !== config.name) {
            toast.error('Nome incorreto. Digite exatamente o nome da empresa.');
            return;
        }
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/companies/${config.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error || 'Erro ao excluir');
            toast.success('Empresa excluída com sucesso.');
            setShowDeleteModal(false);
            if (onDelete) onDelete();
        } catch (e) {
            toast.error(`Erro ao excluir: ${e.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    // Test Pipefy — uses backend proxy which falls back to PIPEFY_TOKEN env var
    const testPipefy = async () => {
        if (!config.pipefyPipeId) {
            toast.error("Preencha o Pipe ID antes de testar.");
            return;
        }
        setTestStatus({ type: 'pipefy', msg: 'Testando conexão...', error: false });
        try {
            const res = await fetch(`/api/integrations/${config.id}/pipefy/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Teste falhou');
            setTestStatus({ type: 'pipefy', msg: `Sucesso! Conexão com Pipefy ativa.`, error: false });
        } catch (e) {
            setTestStatus({ type: 'pipefy', msg: `Erro: ${e.message}`, error: true });
        }
    };

    // Test Meta Ads — uses backend which falls back to META_ADS_TOKEN env var
    const testMeta = async () => {
        setTestStatus({ type: 'meta', msg: 'Testando conexão...', error: false });
        try {
            const res = await fetch(`/api/integrations/${config.id}/meta/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Teste falhou');
            const msg = result.campaigns
                ? `Sucesso! ${result.campaigns} campanhas encontradas.`
                : `Sucesso! Conexão com Meta Ads ativa.`;
            setTestStatus({ type: 'meta', msg, error: false });
        } catch (e) {
            setTestStatus({ type: 'meta', msg: `Erro: ${e.message}`, error: true });
        }
    };

    // Sync Pipefy deals to DB
    const pipefySync = async () => {
        if (!config.id) {
            toast.error("Salve a empresa antes de sincronizar.");
            return;
        }
        setTestStatus({ type: 'sync', msg: 'Sincronizando cards do Pipefy...', error: false });
        try {
            const res = await fetch(`/api/sync/${config.id}/pipefy`, { method: 'POST' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Sync falhou');
            const count = result.rowsUpserted ?? 0;
            setTestStatus({ type: 'sync', msg: `Sucesso! ${count} registros sincronizados.`, error: false });
            toast.success(`Pipefy sincronizado — ${count} cards salvos!`);
        } catch (e) {
            console.error("Pipefy sync error:", e);
            setTestStatus({ type: 'sync', msg: `Erro: ${e.message}`, error: true });
            toast.error(`Erro na sincronização: ${e.message}`);
        }
    };

    if (!company) {
        return (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
                <GlassCard className="p-12 text-center">
                    <div className="w-20 h-20 bg-[var(--surface-raised)] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Building className="w-10 h-10 text-[var(--text-muted)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Selecione uma Organização</h2>
                    <p className="text-[var(--text-secondary)] max-w-md mx-auto">Para acessar as configurações, selecione primeiro uma organização no menu principal.</p>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32 relative font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FD295E]/10 text-[#FD295E] text-xs font-bold uppercase tracking-wider mb-3">
                        Configurações
                    </div>
                    {allCompanies.length > 1 && onCompanyChange ? (
                        <select
                            value={company.id}
                            onChange={e => {
                                const chosen = allCompanies.find(c => c.id === e.target.value);
                                if (chosen) onCompanyChange(chosen);
                            }}
                            className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight bg-transparent border-none outline-none cursor-pointer hover:text-[#FD295E] transition-colors"
                        >
                            {allCompanies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    ) : (
                        <h1 className="text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
                            {company.name}
                        </h1>
                    )}
                    <p className="text-[var(--text-secondary)] mt-2 text-lg">Gerencie dados, acessos e integrações da sua organização.</p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={status === 'saving'}
                    className={`px-6 py-3 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg shadow-[#FD295E]/30 transition-all transform hover:-translate-y-0.5 ${status === 'saving' ? 'bg-[#FD295E]/70 cursor-wait' : 'bg-[#FD295E] hover:bg-[#e11d48]'}`}
                >
                    {status === 'saving'
                        ? <><span>Salvando...</span><Save className="w-4 h-4 animate-bounce" /></>
                        : status === 'success'
                        ? <><span>Salvo!</span><CheckCircle className="w-4 h-4" /></>
                        : <><span>Salvar Alterações</span><Save className="w-4 h-4" /></>}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column */}
                <div className="lg:col-span-4 space-y-8">

                    {/* Company Data */}
                    <GlassCard className="p-6">
                        <SectionHeader icon={Building} title="Dados da Organização" />
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">Nome da Organização</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={config.name}
                                    onChange={handleChange}
                                    className="w-full p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all font-medium text-lg"
                                    placeholder="Ex: Minha Empresa"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">CNPJ</label>
                                <input
                                    type="text"
                                    name="cnpj"
                                    value={config.cnpj}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all"
                                    placeholder="XX.XXX.XXX/XXXX-XX"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">Logo da Marca</label>
                                <div className="group relative w-full h-40 rounded-2xl border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--brand)] transition-all bg-[var(--surface-raised)] overflow-hidden flex flex-col items-center justify-center cursor-pointer">
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    {config.logo ? (
                                        <div className="relative w-full h-full p-4 flex items-center justify-center bg-[var(--surface)]">
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
                                            <p className="text-sm font-medium text-[var(--text-secondary)]">Clique para enviar</p>
                                            <p className="text-xs text-[var(--text-muted)] mt-1">PNG, JPG (Max 2MB)</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Access Management */}
                    <GlassCard className="p-6">
                        <SectionHeader icon={Users} title="Gestão de Acesso" />

                        <div className="flex gap-2 mb-6">
                            <input
                                type="email"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                placeholder="E-mail do novo usuário..."
                                className="flex-1 p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand)] text-sm"
                            />
                            <button onClick={handleAddUser} className="bg-[var(--brand)] text-white p-3 rounded-xl hover:opacity-80 transition-opacity">
                                <UserPlus className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {companyUsers.map((user, idx) => (
                                <div key={idx} className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-hover)] transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[var(--surface-raised)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)] shadow-inner">
                                            {user.email.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate w-32 md:w-40">{user.email}</p>
                                            <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{user.role}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveClick(user.email)} className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {companyUsers.length === 0 && (
                                <p className="text-center text-sm text-[var(--text-muted)] py-4 italic">Nenhum usuário adicional.</p>
                            )}
                        </div>
                    </GlassCard>
                </div>

                {/* Right Column: Integrations */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Pipefy Integration */}
                    <GlassCard className="border-l-4 border-l-[#FD295E]">
                        <div className="p-4 sm:p-6 md:p-8">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#0065FF]/10 text-[#0065FF] rounded-2xl flex items-center justify-center">
                                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-8h2v8z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Integração Pipefy</h2>
                                        <p className="text-sm text-[var(--text-secondary)]">Conecte seu fluxo de vendas para automação de métricas.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <ServerTokenBadge />
                                    <button
                                        onClick={testPipefy}
                                        className="px-4 py-2 bg-[#0065FF]/10 text-[#0065FF] rounded-lg hover:bg-[#0065FF]/20 font-bold text-xs uppercase tracking-wide flex items-center gap-2"
                                    >
                                        <Play className="w-3 h-3" /> Testar
                                    </button>
                                    <button
                                        onClick={pipefySync}
                                        className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 font-bold text-xs uppercase tracking-wide flex items-center gap-2"
                                    >
                                        ↻ Sincronizar
                                    </button>
                                </div>
                            </div>

                            {/* Feedback area (Pipefy test + sync) */}
                            {testStatus && (testStatus.type === 'pipefy' || testStatus.type === 'sync') && (
                                <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${testStatus.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                    {testStatus.error ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                                    {testStatus.msg}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Org ID</label>
                                    <input
                                        type="text"
                                        name="pipefyOrgId"
                                        value={config.pipefyOrgId}
                                        onChange={handleChange}
                                        className="w-full p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand)]"
                                        placeholder="Ex: 123456"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Pipe ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="pipefyPipeId"
                                            value={config.pipefyPipeId}
                                            onChange={handleChange}
                                            onBlur={() => config.pipefyPipeId && loadPipeDetails(config.pipefyPipeId)}
                                            className="flex-1 p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand)]"
                                            placeholder="Ex: 789012"
                                        />
                                        <button
                                            onClick={() => loadPipeDetails(config.pipefyPipeId)}
                                            disabled={loadingPipeDetails || !config.pipefyPipeId}
                                            title="Recarregar fases do pipe"
                                            className="p-3 bg-[var(--surface-raised)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${loadingPipeDetails ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* PipeFinder Helper */}
                            <PipeFinder />
                        </div>

                        {/* Advanced Mapping — always visible, no PIN lock */}
                        <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 md:p-8">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="h-px bg-[var(--border)] flex-1"></div>
                                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Mapeamento Avançado</span>
                                <div className="h-px bg-[var(--border)] flex-1"></div>
                            </div>

                            {!pipeDetails.loaded ? (
                                <div className="text-center py-8 text-sm text-[var(--text-muted)]">
                                    <p>Preencha o Pipe ID acima para carregar as fases e campos disponíveis.</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <PhaseMultiSelect
                                            label="Fase GANHO"
                                            type="won"
                                            selectedIds={(config.wonPhaseId || '').split(',')}
                                            phases={pipeDetails.phases}
                                            onSelect={(id) => handlePhaseSelect('won', id)}
                                        />
                                        <PhaseMultiSelect
                                            label="Fase PERDIDO"
                                            type="lost"
                                            selectedIds={(config.lostPhaseId || '').split(',')}
                                            phases={pipeDetails.phases}
                                            onSelect={(id) => handlePhaseSelect('lost', id)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--surface-raised)] rounded-2xl border border-[var(--border)]">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Campo Valor</label>
                                            <select name="valueField" value={config.valueField || ''} onChange={handleChange} className="w-full p-2.5 bg-[var(--surface-raised)] border border-transparent hover:border-[var(--border)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]">
                                                <option value="">✨ Automático (Inteligente)</option>
                                                {pipeDetails.fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                                                <option value="__custom__">✏️ Manual</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Motivo Perda</label>
                                            <select name="lossReasonField" value={config.lossReasonField || ''} onChange={handleChange} className="w-full p-2.5 bg-[var(--surface-raised)] border border-transparent hover:border-[var(--border)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]">
                                                <option value="">✨ Automático (Inteligente)</option>
                                                {pipeDetails.fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                                                <option value="__custom__">✏️ Manual</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </GlassCard>

                    {/* Meta Ads Integration */}
                    <GlassCard className="border-l-4 border-l-blue-500">
                        <div className="p-4 sm:p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                                        <div className="w-5 h-5 bg-blue-500 rounded-full" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Integração Meta Ads</h2>
                                        <p className="text-sm text-[var(--text-secondary)]">Conecte sua conta de anúncios para rastreamento de campanhas.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ServerTokenBadge />
                                    <button
                                        onClick={testMeta}
                                        className="text-blue-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-blue-500/10 px-3 py-2 rounded-lg transition-colors"
                                    >
                                        <Play className="w-3 h-3" /> Testar Conexão
                                    </button>
                                </div>
                            </div>

                            {testStatus && testStatus.type === 'meta' && (
                                <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${testStatus.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                    {testStatus.error ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                                    {testStatus.msg}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1 mb-2 block">Ad Account ID</label>
                                <input
                                    type="text"
                                    name="metaAdAccountId"
                                    value={config.metaAdAccountId}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand)]"
                                    placeholder="Ex: act_123456789"
                                />
                            </div>
                        </div>
                    </GlassCard>

                </div>
            </div>

            {/* Danger Zone — Delete Company */}
            <div className="mt-12 pt-8 border-t border-red-500/20">
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Zona de Perigo
                </h3>
                <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <div>
                        <p className="font-semibold text-[var(--text-primary)]">Excluir esta Organização</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Todos os dados serão permanentemente removidos.</p>
                    </div>
                    <button
                        onClick={() => { setDeleteConfirmName(''); setShowDeleteModal(true); }}
                        className="px-4 py-2 bg-red-600/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-600/20 font-semibold text-sm transition-colors flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Excluir Empresa
                    </button>
                </div>
            </div>

            {/* Remove User Modal */}
            {showRemoveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-lg)] p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-[var(--border)]">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="w-10 h-10 text-red-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-[var(--text-primary)]">Remover Acesso?</h3>
                            <p className="text-[var(--text-secondary)] mt-2 leading-relaxed">
                                O usuário <span className="font-bold text-[var(--text-primary)]">{userToRemove}</span> perderá acesso imediato.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setShowRemoveModal(false); setUserToRemove(null); }} className="py-4 text-[var(--text-secondary)] font-bold hover:bg-[var(--surface-hover)] rounded-2xl transition-colors">Cancelar</button>
                            <button onClick={confirmRemoveUser} className="py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95">Sim, Remover</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Company Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-lg)] p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-red-500/30">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Excluir Organização?</h3>
                            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                                Esta ação é irreversível. Digite <span className="font-bold text-red-400">{config.name}</span> para confirmar.
                            </p>
                        </div>
                        <input
                            type="text"
                            value={deleteConfirmName}
                            onChange={e => setDeleteConfirmName(e.target.value)}
                            placeholder={config.name}
                            className="w-full p-3 mb-4 bg-[var(--surface-raised)] border border-red-500/30 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm text-center"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="py-3 text-[var(--text-secondary)] font-bold hover:bg-[var(--surface-hover)] rounded-2xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCompany}
                                disabled={isDeleting || deleteConfirmName !== config.name}
                                className="py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                {isDeleting ? 'Excluindo...' : 'Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
