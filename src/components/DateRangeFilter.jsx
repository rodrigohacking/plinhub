import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

export function DateRangeFilter({ value, onChange }) {
    const options = [
        { label: 'Todo o Período', value: 'all-time' },
        { label: 'Mês Atual', value: 'this-month' },
        { label: 'Mês Anterior', value: 'last-month' },
        { label: 'Últimos 3 Meses', value: 'last-3-months' },
        { label: 'Últimos 6 Meses', value: 'last-6-months' },
        { label: 'Este Ano', value: 'this-year' },
        { label: 'Data Exata...', value: 'custom' },
    ];

    const isCustom = value?.startsWith('custom:');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');

    // Parse initial value if custom
    React.useEffect(() => {
        if (isCustom) {
            const parts = value.split(':');
            if (parts.length === 3) {
                setStartDate(parts[1]);
                setEndDate(parts[2]);
            }
        }
    }, []);

    const handleSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'custom') {
            // Default to today if custom is selected but no dates yet
            const today = new Date().toISOString().split('T')[0];
            const newVal = `custom:${today}:${today}`;
            setStartDate(today);
            setEndDate(today);
            onChange(newVal);
        } else {
            onChange(val);
        }
    };

    const handleDateChange = (start, end) => {
        setStartDate(start);
        setEndDate(end);
        onChange(`custom:${start}:${end}`);
    };

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <div className="flex items-center gap-2 bg-white dark:bg-[#111] p-1 rounded-lg border border-gray-200 dark:border-white/10 shadow-sm h-[38px]">
                <div className="px-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                </div>
                <select
                    value={isCustom ? 'custom' : value}
                    onChange={handleSelectChange}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 rounded p-1"
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {isCustom && (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => handleDateChange(e.target.value, endDate)}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg p-1.5 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-gray-400 text-xs font-bold">ATÉ</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => handleDateChange(startDate, e.target.value)}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg p-1.5 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            )}
        </div>
    );
}

// Helper to filter dates
export function filterByDateRange(items, range, dateField = 'date') {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return items.filter(item => {
        let dateVal = item[dateField];
        let d;
        // Fix: If dateVal is YYYY-MM-DD string, append T12:00:00 to prevent UTC shift
        if (typeof dateVal === 'string' && dateVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
            d = new Date(dateVal + 'T12:00:00');
        } else {
            d = new Date(dateVal);
        }

        const m = d.getMonth();
        const y = d.getFullYear();

        switch (range) {
            case 'all-time':
                return true;
            case 'this-month':
                return m === currentMonth && y === currentYear;
            case 'last-month': {
                // Handle Jan -> Dec transition properly
                const lastM = currentMonth === 0 ? 11 : currentMonth - 1;
                const lastY = currentMonth === 0 ? currentYear - 1 : currentYear;
                return m === lastM && y === lastY;
            }
            case 'last-3-months': {
                const start3 = new Date(now);
                start3.setMonth(start3.getMonth() - 2); // Current + 2 prev = 3
                start3.setDate(1);
                start3.setHours(0, 0, 0, 0);
                return d >= start3 && d <= now;
            }
            case 'last-6-months': {
                const start6 = new Date(now);
                start6.setMonth(start6.getMonth() - 5);
                start6.setDate(1);
                start6.setHours(0, 0, 0, 0);
                return d >= start6 && d <= now;
            }
            case 'this-year':
                return y === currentYear;
            default:
                if (range?.startsWith('custom:')) {
                    const parts = range.split(':');
                    if (parts.length === 3) {
                        const start = new Date(parts[1] + 'T00:00:00');
                        const end = new Date(parts[2] + 'T23:59:59');
                        return d >= start && d <= end;
                    }
                }
                return true;
        }
    });
}
