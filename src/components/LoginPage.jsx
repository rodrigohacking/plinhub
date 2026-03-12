import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export function LoginPage() {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
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
            if (err.message?.includes('Email not confirmed')) {
                setError('Por favor, confirme seu email antes de fazer login.');
            } else if (err.message?.includes('Invalid login credentials')) {
                setError('Email ou senha incorretos.');
            } else {
                setError('Falha no login. Verifique suas informações.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
            {/* Background dots pattern */}
            <div className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                    backgroundSize: '28px 28px'
                }}
            />

            <div className="relative z-10 w-full max-w-[400px]">
                {/* Card */}
                <div className="bg-white dark:bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-lg)] p-8">

                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <img
                            src="/logo-hub.png"
                            alt="PLIN HUB"
                            className="h-16 object-contain mb-4"
                            onError={(e) => e.target.style.display = 'none'}
                        />
                        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                            Bem-vindo de volta
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Acesse o painel administrativo
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--brand)] transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[var(--text-primary)]">Senha</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--brand)] transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full border border-[var(--border)] bg-[var(--surface-raised)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 transition-all tracking-wider"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-semibold py-2.5 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 group mt-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Entrar
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-[var(--text-muted)] mt-6">
                        © {new Date().getFullYear()} Grupo Plin
                    </p>
                </div>
            </div>
        </div>
    );
}
