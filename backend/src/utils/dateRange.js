/**
 * Date range utilities with proper Brazil timezone (BRT = UTC-3) support.
 * Brazil does NOT observe DST since 2019, so offset is always -3h.
 */

// Returns today's date in BRT as 'YYYY-MM-DD'
const getTodayBRT = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// Midnight BRT of a given date string = 03:00 UTC
const brtStartUTC = (dateStr) => new Date(dateStr + 'T03:00:00.000Z');

// End of day BRT of a given date string = next day 02:59:59.999 UTC
const brtEndUTC = (dateStr) =>
    new Date(new Date(dateStr + 'T03:00:00.000Z').getTime() + 86400000 - 1);

// Add N days to a YYYY-MM-DD string (positive = future, negative = past)
const addDays = (dateStr, days) => {
    const d = new Date(dateStr + 'T12:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
};

/**
 * Parses a dateRange string and returns { startDate, endDate } as UTC Date objects.
 * @param {string} range - e.g. 'last-7-days', 'this-month', 'custom:2026-01-01:2026-03-09'
 * @returns {{ startDate: Date, endDate: Date }}
 */
function parseDateRange(range = 'this-month') {
    const today = getTodayBRT(); // 'YYYY-MM-DD'
    const [year, month] = today.split('-').map(Number);

    // Simple Nd patterns: '7d', '30d', '90d'
    const simpleDays = /^(\d+)d$/.exec(range);
    if (simpleDays) {
        return {
            startDate: brtStartUTC(addDays(today, -parseInt(simpleDays[1]))),
            endDate: brtEndUTC(today),
        };
    }

    // Custom range: 'custom:YYYY-MM-DD:YYYY-MM-DD'
    if (range.startsWith('custom:')) {
        const parts = range.split(':');
        if (parts.length === 3) {
            return {
                startDate: brtStartUTC(parts[1]),
                endDate: brtEndUTC(parts[2]),
            };
        }
    }

    switch (range) {
        case 'today':
            return { startDate: brtStartUTC(today), endDate: brtEndUTC(today) };

        case 'yesterday': {
            const yest = addDays(today, -1);
            return { startDate: brtStartUTC(yest), endDate: brtEndUTC(yest) };
        }

        case 'last-7-days':
            return { startDate: brtStartUTC(addDays(today, -7)), endDate: brtEndUTC(addDays(today, -1)) };

        case 'last-30-days':
            return { startDate: brtStartUTC(addDays(today, -30)), endDate: brtEndUTC(addDays(today, -1)) };

        case 'this-month': {
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            return { startDate: brtStartUTC(start), endDate: brtEndUTC(today) };
        }

        case 'last-month': {
            const lm = month === 1 ? 12 : month - 1;
            const ly = month === 1 ? year - 1 : year;
            const start = `${ly}-${String(lm).padStart(2, '0')}-01`;
            const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
            const end = `${ly}-${String(lm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { startDate: brtStartUTC(start), endDate: brtEndUTC(end) };
        }

        case 'last-3-months': {
            let sm = month - 2, sy = year;
            if (sm <= 0) { sm += 12; sy--; }
            const start = `${sy}-${String(sm).padStart(2, '0')}-01`;
            return { startDate: brtStartUTC(start), endDate: brtEndUTC(today) };
        }

        case 'last-6-months': {
            let sm = month - 5, sy = year;
            if (sm <= 0) { sm += 12; sy--; }
            const start = `${sy}-${String(sm).padStart(2, '0')}-01`;
            return { startDate: brtStartUTC(start), endDate: brtEndUTC(today) };
        }

        case 'this-year':
            return { startDate: brtStartUTC(`${year}-01-01`), endDate: brtEndUTC(today) };

        case 'all-time':
            return { startDate: new Date('2000-01-01T00:00:00.000Z'), endDate: brtEndUTC(today) };

        default:
            return { startDate: brtStartUTC(addDays(today, -30)), endDate: brtEndUTC(today) };
    }
}

module.exports = { parseDateRange };
