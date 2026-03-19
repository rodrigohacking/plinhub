import React, { useState, useEffect } from 'react';

const PHRASES = [
    'Carregando inteligência comercial...',
    'Conectando com seus dados de vendas...',
    'Sincronizando métricas do período...',
    'Preparando seu painel de performance...',
    'Analisando funil de conversão...',
    'Calculando custo por lead...',
    'Buscando resultados das campanhas...',
    'Organizando dados do Pipefy...',
];

function useTypewriter(phrases) {
    const [displayText, setDisplayText] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const current = phrases[phraseIndex % phrases.length];

        if (!isDeleting && charIndex < current.length) {
            const timeout = setTimeout(() => {
                setDisplayText(current.slice(0, charIndex + 1));
                setCharIndex(c => c + 1);
            }, 38);
            return () => clearTimeout(timeout);
        }

        if (!isDeleting && charIndex === current.length) {
            const timeout = setTimeout(() => setIsDeleting(true), 1400);
            return () => clearTimeout(timeout);
        }

        if (isDeleting && charIndex > 0) {
            const timeout = setTimeout(() => {
                setDisplayText(current.slice(0, charIndex - 1));
                setCharIndex(c => c - 1);
            }, 18);
            return () => clearTimeout(timeout);
        }

        if (isDeleting && charIndex === 0) {
            setIsDeleting(false);
            setPhraseIndex(i => (i + 1) % phrases.length);
        }
    }, [charIndex, isDeleting, phraseIndex, phrases]);

    return displayText;
}

export function Loading() {
    const text = useTypewriter(PHRASES);

    return (
        <div className="fixed inset-0 h-screen w-screen bg-[#09090b] flex flex-col items-center justify-center z-[9999] gap-8">
            {/* Spinner */}
            <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-[#FD295E] animate-spin" />

            {/* Typewriter text */}
            <div className="h-6 flex items-center">
                <span className="text-zinc-400 text-sm font-mono tracking-wide">
                    {text}
                    <span className="animate-pulse text-[#FD295E]">|</span>
                </span>
            </div>
        </div>
    );
}
