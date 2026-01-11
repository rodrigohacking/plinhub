import React from 'react';
import { Loader2 } from 'lucide-react';

export function Loading() {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-black"></div>

            {/* Glow Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FD295E]/5 blur-[120px] rounded-full animate-pulse"></div>

            <div className="relative z-10 flex flex-col items-center">
                {/* Premium Spinner */}
                <div className="relative mb-8">
                    {/* Soft glow behind spinner */}
                    <div className="absolute inset-0 bg-[#FD295E]/20 blur-xl rounded-full"></div>
                    <Loader2 className="w-12 h-12 text-[#FD295E] animate-spin relative opacity-90" strokeWidth={1.5} />
                </div>

                {/* Text */}
                <div className="flex flex-col items-center gap-3">
                    <p className="text-sm font-medium text-[#FD295E] tracking-widest animate-pulse">
                        Carregando...
                    </p>
                </div>
            </div>
        </div>
    );
}
