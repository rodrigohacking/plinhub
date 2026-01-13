import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoginPage() {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Clear URL params (companyId, view) when on login page
        // helping ensure a fresh start on login.
        if (window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(email, password);
        } catch (err) {
            console.error("Login Failed - Detailed Error:", err);
            window.lastError = err; // Expose for UI
            // Check for specific Supabase error codes
            if (err.message && err.message.includes('Email not confirmed')) {
                setError('Por favor, confirme seu email antes de fazer login.');
            } else if (err.message && err.message.includes('Invalid login credentials')) {
                setError('Email ou senha incorretos.');
            } else {
                setError('Falha no login. Verifique suas informações.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1a1a1a] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                {/* Glow Effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#FD295E]/20 blur-[60px] rounded-full pointer-events-none" />

                {/* Header */}
                <div className="text-center mb-10 relative z-10">
                    <div className="flex justify-center mb-6">
                        <img
                            src="/logo-hub.png"
                            alt="PLIN HUB"
                            className="h-32 object-contain drop-shadow-lg filter brightness-110"
                        />
                    </div>
                    <p className="text-gray-400 text-sm">Acesse o painel administrativo</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                            {error}
                            <div className="text-[10px] mt-1 opacity-75 font-mono border-t border-red-500/20 pt-1">
                                {window.lastError?.message || ''}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FD295E] transition-colors">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FD295E]/50 focus:ring-1 focus:ring-[#FD295E]/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">Senha</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FD295E] transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FD295E]/50 focus:ring-1 focus:ring-[#FD295E]/50 transition-all font-medium tracking-wider"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#FD295E] hover:bg-[#E11D4E] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#FD295E]/10 hover:shadow-[#FD295E]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group mt-4 relative overflow-hidden"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Entrar no Sistema
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <div className="text-center mt-6">
                        <p className="text-xs text-gray-600">© 2026 Grupo Plin</p>
                        <p className="text-[10px] text-gray-800 mt-2 font-mono opacity-50">
                            Server: {import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'Unknown'}
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
