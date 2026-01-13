import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const BOOT_MESSAGES = [
    'Estabelecendo conexão segura...',
    'Carregando módulos de IA...',
    'Otimizando dashboards...',
    'Sincronizando dados em tempo real...',
    'Preparando ambiente...',
    'Iniciando PLIN SYSTEM...'
];

export function Loading() {
    const [displayedText, setDisplayedText] = useState('');
    const [msgIndex, setMsgIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        let timeout;

        if (isWaiting) {
            // Wait before clearing and starting next message
            timeout = setTimeout(() => {
                setDisplayedText('');
                setCharIndex(0);
                setIsWaiting(false);
                setMsgIndex((prev) => (prev + 1) % BOOT_MESSAGES.length);
            }, 2000); // 2 seconds wait after finishing typing
        } else {
            // Typewriter effect
            if (charIndex < BOOT_MESSAGES[msgIndex].length) {
                timeout = setTimeout(() => {
                    setDisplayedText((prev) => prev + BOOT_MESSAGES[msgIndex][charIndex]);
                    setCharIndex((prev) => prev + 1);
                }, 50); // Typing speed
            } else {
                setIsWaiting(true);
            }
        }

        return () => clearTimeout(timeout);
    }, [charIndex, isWaiting, msgIndex]);

    return (
        <div className="fixed inset-0 h-screen w-screen bg-black flex flex-col items-center justify-center overflow-hidden z-[9999]">
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-900">
                <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 6, ease: "linear" }}
                    className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                />
            </div>

            {/* Ambient Background */}
            <div className="absolute inset-0 bg-black"></div>

            {/* Central Glow Effect - Reduced intensity/color for B&W feel but keeping subtle brand hint or just white/gray */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full animate-pulse"></div>

            <div className="relative z-10 flex flex-col items-center justify-center gap-6">
                {/* System Boot Text (Typewriter) */}
                <div className="h-16 flex flex-col items-center justify-center gap-4">
                    <p className="text-sm font-bold bg-gradient-to-r from-[#FD295E] to-purple-600 bg-clip-text text-transparent tracking-widest text-center min-w-[300px] uppercase drop-shadow-sm">
                        {displayedText}
                        <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="inline-block w-1.5 h-4 bg-[#FD295E] ml-1 align-middle shadow-[0_0_10px_#FD295E]"
                        />
                    </p>

                    {/* Additional Loading Spinner */}
                    <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 text-[#FD295E] animate-spin" />
                    </div>
                </div>
            </div>
        </div>
    );
}
