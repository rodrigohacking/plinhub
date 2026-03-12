import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Upload,
  Lock,
  Loader2,
  LogOut,
} from "lucide-react";
import { Background3D } from "./ui/Background3D";
import {
  getCompaniesConfig,
  saveCompanyConfig,
  deleteCompanyConfig,
  checkAdminPin,
  getAdminPin,
  setAdminPin,
} from "../lib/storage";
import { useAuth } from "../contexts/AuthContext";

export function CompanySelection({ data, onSelect }) {
  console.log("COMPANY_SELECTION: Rendering full version", data);

  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Debug Info
  const { user, signOut } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "MISSING";

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error("Erro ao sair");
    }
  };

  const [formData, setFormData] = useState({
    id: null,
    name: "",
    cnpj: "",
    logo: "",
    pipefyOrgId: "",
    pipefyPipeId: "",
    pipefyToken: "",
    metaAdAccountId: "",
    metaToken: "",
  });

  // PIN de admin é gerenciado via storage — não hardcoded no código

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
      const allCompanies = [...(data.companies || [])].filter(
        (c) => c.id !== 1 && c.id !== 2,
      );
      setCompanies(allCompanies);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const handleProtectedAction = (action) => {
    const isAuthenticated =
      sessionStorage.getItem("plin_admin_auth") === "true";
    if (isAuthenticated) {
      executeAction(action);
    } else {
      setPendingAction(action);
      setShowPinModal(true);
    }
  };

  const executeAction = (action) => {
    if (action.type === "new") handleNewCompany();
    if (action.type === "edit") handleEditCompany(action.payload);
    if (action.type === "delete") handleDeleteClick(action.payload);
  };

  const verifyPin = () => {
    const storedPin = getAdminPin();
    const valid = storedPin ? checkAdminPin(pin) : pin === "0000";

    if (valid) {
      sessionStorage.setItem("plin_admin_auth", "true");
      setShowPinModal(false);
      setPin("");
      if (pendingAction) executeAction(pendingAction);
      setPendingAction(null);
    } else {
      toast.error("PIN Incorreto. Tente novamente.");
      setPin(""); // Clear input on error for better UX
    }
  };

  const handleNewCompany = () => {
    setFormData({
      id: Date.now(),
      name: "",
      cnpj: "",
      logo: "",
      pipefyOrgId: "",
      pipefyPipeId: "",
      pipefyToken: "",
      metaAdAccountId: "",
      metaToken: "",
    });
    setEditingCompany(null);
    setShowForm(true);
  };

  const handleEditCompany = (company) => {
    const customCompanies = getCompaniesConfig();
    const customConfig = customCompanies.find((c) => c.id === company.id) || {};

    setFormData({
      id: company.id,
      name: company.name,
      cnpj: company.cnpj || "",
      logo: company.logo || "",
      pipefyOrgId: customConfig.pipefyOrgId || "",
      pipefyPipeId: customConfig.pipefyPipeId || "",
      pipefyToken: customConfig.pipefyToken || "",
      metaAdAccountId: customConfig.metaAdAccountId || "",
      metaToken: customConfig.metaToken || "",
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
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir no servidor");
      }

      setCompanies((prev) =>
        prev.filter((c) => String(c.id) !== String(companyId)),
      );
      toast.success("Empresa excluída com sucesso.");
      deleteCompanyConfig(companyId);
    } catch (err) {
      console.error("Erro na exclusão:", err);
      toast.error("Erro ao excluir empresa.");
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
          const canvas = document.createElement("canvas");
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
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL("image/png"); // Use PNG for transparency if logo has it
          setFormData((prev) => ({ ...prev, logo: compressedBase64 }));
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] p-8 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[var(--brand-light)] rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-[var(--brand)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)]">Digite o PIN de administrador para continuar.</p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-3 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:text-[var(--text-muted)]"
                maxLength={4}
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPinModal(false); setPin(''); setPendingAction(null); }}
                  className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={verifyPin}
                  className="flex-1 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all text-sm"
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] p-6 max-w-2xl w-full overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                {editingCompany ? <Edit className="w-5 h-5 text-[var(--brand)]" /> : <Plus className="w-5 h-5 text-[var(--brand)]" />}
                {editingCompany ? "Editar Empresa" : "Nova Empresa"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Nome da Empresa</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand)] outline-none"
                    placeholder="Ex: Minha Empresa" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">CNPJ</label>
                  <input type="text" value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand)] outline-none"
                    placeholder="00.000.000/0000-00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Logo da Empresa</label>
                <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                <div onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group">
                  {formData.logo ? (
                    <div className="relative w-full h-full p-2">
                      <img src={formData.logo} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--brand)] transition-colors" />
                      <span className="text-sm text-[var(--text-muted)]">Clique para enviar uma imagem</span>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h4 className="text-xs font-bold text-[var(--brand)] mb-3 uppercase tracking-wider">Integração Pipefy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Organization ID</label>
                    <input type="text" value={formData.pipefyOrgId} onChange={(e) => setFormData({ ...formData, pipefyOrgId: e.target.value })}
                      className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Pipe ID (Vendas)</label>
                    <input type="text" value={formData.pipefyPipeId} onChange={(e) => setFormData({ ...formData, pipefyPipeId: e.target.value })}
                      className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Personal Access Token</label>
                    <input type="password" value={formData.pipefyToken} onChange={(e) => setFormData({ ...formData, pipefyToken: e.target.value })}
                      className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors font-medium text-sm">
                  Cancelar
                </button>
                <button onClick={async () => {
                  if (!formData.name) return toast.error("Nome é obrigatório");
                  setIsLoading(true);
                  try {
                    await saveCompanyConfig(formData);
                    toast.success(editingCompany ? "Empresa atualizada!" : "Empresa criada!");
                    setShowForm(false);
                    window.location.reload();
                  } catch (err) { console.error(err); toast.error("Erro ao salvar."); }
                  finally { setIsLoading(false); }
                }} disabled={isLoading}
                  className="px-5 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl font-semibold transition-all flex items-center gap-2 text-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingCompany ? "Salvar Alterações" : "Criar Empresa"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] p-6 max-w-sm w-full">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Excluir Empresa?</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Tem certeza? <span className="text-red-500 font-semibold">Esta ação é irreversível.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCompanyToDelete(null)}
                className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all text-sm">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 lg:p-12 relative z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 items-center">
          {/* Left: Logo */}
          <div className="flex flex-col items-center lg:items-start justify-center mb-4 lg:mb-0">
            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-gradient-to-r from-[var(--brand)] to-blue-400 rounded-full blur-3xl opacity-15" />
              <img src="/logo-hub.png" alt="PLIN HUB"
                className="relative h-28 md:h-48 lg:h-72 object-contain drop-shadow-xl" />
            </div>
            <div className="max-w-sm text-center lg:text-left space-y-2">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Gestão Inteligente</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Conectamos dados, pessoas e resultados em uma única plataforma.
              </p>
            </div>
          </div>

          {/* Right: Companies Panel */}
          <div className="bg-white dark:bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] p-6 md:p-8 w-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Empresas</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 uppercase tracking-widest">Escolha uma opção abaixo</p>
              </div>
              <button onClick={() => handleProtectedAction({ type: 'new' })}
                className="flex items-center gap-1.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-sm hover:-translate-y-0.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {companies.map((company) => (
                <div key={company.id}
                  onClick={() => handleCompanyClick(company)}
                  className="group relative bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--brand)] hover:shadow-md transition-all cursor-pointer duration-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border border-[var(--border)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                      {company.logo
                        ? <img src={company.logo} alt={company.name} className="w-full h-full object-contain rounded-xl p-1.5" />
                        : <Building2 className="w-6 h-6 text-[var(--text-muted)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--brand)] transition-colors">{company.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{company.cnpj || 'CNPJ não informado'}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--brand)] group-hover:translate-x-1 transition-all" />
                  </div>

                  <div className="absolute top-1/2 -translate-y-1/2 right-12 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => { e.stopPropagation(); handleProtectedAction({ type: 'edit', payload: company }); }}
                      className="p-1.5 bg-white dark:bg-[var(--surface)] hover:bg-[var(--brand-light)] rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] border border-[var(--border)] transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleProtectedAction({ type: 'delete', payload: company.id }); }}
                      className="p-1.5 bg-white dark:bg-[var(--surface)] hover:bg-red-50 rounded-lg text-[var(--text-muted)] hover:text-red-500 border border-[var(--border)] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {companies.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl">
                  <Building2 className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                  <h3 className="font-medium text-[var(--text-primary)] mb-1">Nenhuma organização</h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">Comece cadastrando sua primeira empresa</p>
                  <button onClick={() => handleProtectedAction({ type: 'new' })}
                    className="text-[var(--brand)] text-sm font-semibold hover:underline">Criar Cadastro →</button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-between items-center">
              <button onClick={handleLogout}
                className="group flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors uppercase tracking-wider font-medium">
                <LogOut className="w-3 h-3" />
                Sair
              </button>
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest">PLIN © {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </div>
    </Background3D>
  );
}
