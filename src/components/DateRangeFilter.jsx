import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

const options = [
    { label: 'Todo o Período', value: 'all-time' },
    { label: 'Hoje', value: 'today' },
    { label: 'Ontem', value: 'yesterday' },
    { label: 'Últimos 7 Dias', value: 'last-7-days' },
    { label: 'Últimos 30 Dias', value: 'last-30-days' },
    { label: 'Mês Atual', value: 'this-month' },
    { label: 'Mês Anterior', value: 'last-month' },
    { label: 'Últimos 3 Meses', value: 'last-3-months' },
    { label: 'Este Ano', value: 'this-year' },
    { label: 'Data Exata...', value: 'custom' },
];

export function DateRangeFilter({ value, onChange }) {
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
    }, [value, isCustom]);

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

// Internal Helper moved out
// Internal Helper moved out
function toBrazilYMD(val) {
    if (!val) return null;
    if (typeof val === 'string') {
        // If YYYY-MM-DD already
        if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
        // If ISO string (YYYY-MM-DDTHH:mm:ss...), split and take date part
        // Standardize: Replace ' ' with 'T' if DB uses spaces (Postgres default)
        const tVal = val.includes(' ') ? val.replace(' ', 'T') : val;
        if (tVal.includes('T')) return tVal.split('T')[0];
    }

    // Fallback for Date objects or other formats
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;

    // If it's a Date object, we might still want to be careful.
    // Ideally we shouldn't reach here for Campaign dates which come as strings.
    // But for 'new Date()' (system time), we usually want "Brazil Time".

    const brazilShifted = new Date(d.getTime() - (3 * 60 * 60 * 1000));
    const y = brazilShifted.getUTCFullYear();
    const m = String(brazilShifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(brazilShifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 3. Helper: Check if a single date is in range (Exported)
export function isDateInSelectedRange(dateVal, range) {
    if (!dateVal) return false;

    const itemYMD = toBrazilYMD(dateVal);
    if (!itemYMD) return false;

    const now = new Date(); // Browser checks system time.
    const todayYMD = toBrazilYMD(now);

    const brazilNowShifted = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const brazilYesterdayShifted = new Date(brazilNowShifted.getTime() - (24 * 60 * 60 * 1000));

    const yYes = brazilYesterdayShifted.getUTCFullYear();
    const mYes = String(brazilYesterdayShifted.getUTCMonth() + 1).padStart(2, '0');
    const dYes = String(brazilYesterdayShifted.getUTCDate()).padStart(2, '0');
    const yesterdayYMD = `${yYes}-${mYes}-${dYes}`;

    switch (range) {
        case 'today':
            return itemYMD === todayYMD;

        case 'yesterday':
            return itemYMD === yesterdayYMD;

        case 'last-7-days':
        case 'last-30-days':
        case 'last-3-months':
        case 'last-6-months': {
            const daysMap = {
                'last-7-days': 7,
                'last-30-days': 30,
                'last-3-months': 90,
                'last-6-months': 180
            };
            const days = daysMap[range];

            const startShifted = new Date(brazilNowShifted.getTime() - (days * 24 * 60 * 60 * 1000));

            const yStart = startShifted.getUTCFullYear();
            const mStart = String(startShifted.getUTCMonth() + 1).padStart(2, '0');
            const dStart = String(startShifted.getUTCDate()).padStart(2, '0');
            const startYMD = `${yStart}-${mStart}-${dStart}`;

            return itemYMD >= startYMD && itemYMD <= todayYMD;
        }

        case 'all-time':
            return true;

        case 'this-month': {
            const itemM = itemYMD.slice(0, 7);
            const targetM = todayYMD.slice(0, 7);
            return itemM === targetM;
        }

        case 'this-year':
            return itemYMD.slice(0, 4) === todayYMD.slice(0, 4);

        case 'last-month': {
            const currentMonth = parseInt(todayYMD.split('-')[1]);
            const currentYear = parseInt(todayYMD.split('-')[0]);

            let lastM = currentMonth - 1;
            let lastY = currentYear;
            if (lastM === 0) { lastM = 12; lastY -= 1; }

            const targetPrefix = `${lastY}-${String(lastM).padStart(2, '0')}`;
            return itemYMD.startsWith(targetPrefix);
        }

        default:
            if (range?.startsWith('custom:')) {
                const parts = range.split(':');
                if (parts.length === 3) {
                    return itemYMD >= parts[1] && itemYMD <= parts[2];
                }
            }
            return true;
    }
}

// Optimized Brazil Date Filter (GMT-3 Strict & High Performance)
export function filterByDateRange(items, range, dateField = 'date') {
    return items.filter(item => isDateInSelectedRange(item[dateField], range));
}
