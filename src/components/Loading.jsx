import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// import { Loader2 } from 'lucide-react'; // Removido conforme solicitado


const BOOT_MESSAGES = [
    'Carregando inteligência de dados...',
    'Sincronizando com Pipefy...',
    'Processando métricas de Meta Ads...',
    'Otimizando performance...',
    'Preparando seu workspace...',
    'Tudo pronto!'
];

export function Loading({ variant = 'boot' }) {
    const [displayedText, setDisplayedText] = useState('');
    const [msgIndex, setMsgIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        if (variant !== 'boot') return;
        
        let timeout;
        if (isWaiting) {
            timeout = setTimeout(() => {
                setDisplayedText('');
                setCharIndex(0);
                setIsWaiting(false);
                setMsgIndex((prev) => (prev + 1) % BOOT_MESSAGES.length);
            }, 2000);
        } else {
            if (charIndex < BOOT_MESSAGES[msgIndex].length) {
                timeout = setTimeout(() => {
                    setDisplayedText((prev) => prev + BOOT_MESSAGES[msgIndex][charIndex]);
                    setCharIndex((prev) => prev + 1);
                }, 50);
            } else {
                setIsWaiting(true);
            }
        }

        return () => clearTimeout(timeout);
    }, [charIndex, isWaiting, msgIndex]);

    return (
        <div className="fixed inset-0 h-screen w-screen bg-[#0a0a0b] flex flex-col items-center justify-center overflow-hidden z-[9999]">
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-900/50">
                <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 4, ease: "linear" }}
                    className="h-full bg-gradient-to-r from-[#FD295E] to-violet-600 shadow-[0_0_15px_rgba(253,41,94,0.5)]"
                />
            </div>

            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FD295E]/5 blur-[120px] rounded-full animate-pulse"></div>

            <div className="relative z-10 flex flex-col items-center justify-center gap-8">

                {/* System Boot Text (Typewriter) */}
                <div className="h-20 flex flex-col items-center justify-start gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm font-bold bg-gradient-to-r from-[#FD295E] to-violet-400 bg-clip-text text-transparent tracking-[0.2em] uppercase">
                            {variant === 'boot' ? displayedText : 'Carregando Plin Hub...'}
                            {variant === 'boot' && (
                                <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                    className="inline-block w-1.5 h-4 bg-[#FD295E] ml-1 align-middle shadow-[0_0_10px_#FD295E]"
                                />
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Brand */}
            <div className="absolute bottom-12 flex flex-col items-center opacity-40">
                <p className="text-[10px] text-gray-500 tracking-[0.5em] uppercase font-bold">Plin Hub Intelligence</p>
            </div>
        </div>
    );
}
