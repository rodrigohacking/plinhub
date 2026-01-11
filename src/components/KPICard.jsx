import React from 'react';
import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function KPICard({ title, value, icon: Icon, trend, trendValue, iconColor = "text-blue-600", iconBg = "bg-blue-50" }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between h-full transition-transform hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-medium text-gray-500">{title}</span>
                <div className={cn("p-2 rounded-lg", iconBg)}>
                    <Icon className={cn("w-5 h-5", iconColor)} />
                </div>
            </div>

            <div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
                {trendValue && (
                    <div className="flex items-center gap-1 text-sm">
                        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                        {trend === 'neutral' && <Minus className="w-4 h-4 text-gray-400" />}

                        <span className={cn(
                            "font-medium",
                            trend === 'up' ? "text-green-600" :
                                trend === 'down' ? "text-red-600" : "text-gray-500"
                        )}>
                            {trendValue}
                        </span>
                        <span className="text-gray-400 ml-1">vs mês anterior</span>
                    </div>
                )}
            </div>
        </div>
    );
}
