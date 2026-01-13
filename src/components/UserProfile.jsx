import React, { useState, useEffect } from 'react';
import { Camera, Save, User, Mail, Lock, Building, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export function UserProfile({ data, onSave }) {
    const { user, updateProfile } = useAuth();
    const fileInputRef = React.useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState(() => {
        // Init from User Context (managed by AuthContext which handles persistence)
        return {
            name: user?.user_metadata?.name || user?.name || '',
            email: user?.email || '',
            role: user?.user_metadata?.role || user?.role || '',
            bio: user?.user_metadata?.bio || user?.bio || '',
            password: '',
            confirmPassword: '',
            photoUrl: user?.user_metadata?.photoUrl || user?.photoUrl || ''
        };
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.user_metadata?.name || user.name || prev.name,
                email: user.email || prev.email,
                role: user.user_metadata?.role || user.role || prev.role,
                bio: user.user_metadata?.bio || user.bio || prev.bio,
                photoUrl: user.user_metadata?.photoUrl || user.photoUrl || prev.photoUrl
            }));
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhotoClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 250; // Aggressive compression for localStorage

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

                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    setFormData({ ...formData, photoUrl: compressedBase64 });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsSaving(true);

        try {
            if (formData.password && formData.password !== formData.confirmPassword) {
                toast.error('As senhas não coincidem!');
                setIsSaving(false);
                return;
            }

            // Simulate a brief delay for UX
            await new Promise(resolve => setTimeout(resolve, 800));

            // 1. Update Password if provided
            if (formData.password) {
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: formData.password
                });

                if (passwordError) {
                    console.error("Password update error:", passwordError);
                    toast.error('Erro ao atualizar senha', {
                        description: passwordError.message === 'weak_password'
                            ? 'A senha deve ter pelo menos 6 caracteres.'
                            : 'Não foi possível alterar sua senha.'
                    });
                    setIsSaving(false);
                    return;
                }

                toast.success('Senha atualizada com sucesso!');
            }

            // 2. Update Profile Data
            const { password, confirmPassword, ...profileData } = formData;
            updateProfile(profileData);

            toast.success('Perfil atualizado com sucesso!', {
                description: 'Suas informações foram salvas.'
            });

            // Clear password fields
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

            if (onSave) onSave();
        } catch (err) {
            console.error("Profile save error:", err);
            toast.error('Erro ao salvar perfil.', {
                description: 'Verifique os dados e tente novamente.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isSaving) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] animate-in fade-in duration-300">
                <Loader2 className="w-16 h-16 animate-spin text-[#FD295E] mb-6" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Salvando Perfil...</h3>
                <p className="text-gray-500 dark:text-gray-400">Atualizando suas informações</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-200">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Meu Perfil</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">Gerencie suas informações pessoais e de acesso.</p>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-[#111] rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-white/5 space-y-8">

                {/* Profile Photo Section */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                    />
                    <div
                        className="relative group cursor-pointer"
                        onClick={handlePhotoClick}
                    >
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 dark:border-white/10 shadow-lg">
                            {formData.photoUrl ? (
                                <img src={formData.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-200 dark:bg-[#222] flex items-center justify-center text-4xl font-bold text-gray-400">
                                    {formData.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 hover:text-[#FD295E] cursor-pointer" onClick={handlePhotoClick}>Clique para alterar a foto</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Personal Info */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-2">
                            Informações Pessoais
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full pl-10 p-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cargo / Função</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full pl-10 p-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Biografia</label>
                            <textarea
                                name="bio"
                                rows="4"
                                value={formData.bio}
                                onChange={handleChange}
                                className="w-full p-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none transition-all resize-none"
                            ></textarea>
                        </div>
                    </div>

                    {/* Right Column: Security */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-2">
                            Segurança e Acesso
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={user?.email || formData.email} // Prefer auth email directly
                                    readOnly // User cannot change auth email
                                    disabled
                                    className="w-full pl-10 p-3 bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-white/5 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-75 outline-none transition-all"
                                />
                                <span className="absolute right-3 top-3.5 text-xs text-gray-400 flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Sistema
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nova Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Deixe em branco para manter a atual"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-10 p-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirmar Nova Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder="Confirme a nova senha"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full pl-10 p-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FD295E] outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-white/10 flex justify-end">
                    <button
                        type="submit"
                        className="px-8 py-3 bg-[#FD295E] hover:bg-[#e11d48] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        Salvar Alterações
                    </button>
                </div>

            </form>
        </div>
    );
}
