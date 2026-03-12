function toBrazilYMD(val) {
    if (!val) return null;
    if (typeof val === 'string') {
        if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
        const tVal = val.includes(' ') ? val.replace(' ', 'T') : val;
        if (tVal.includes('T')) return tVal.split('T')[0];
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const brazilShifted = new Date(d.getTime() - (3 * 60 * 60 * 1000));
    const y = brazilShifted.getUTCFullYear();
    const m = String(brazilShifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(brazilShifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function isDateInSelectedRange(dateVal, range) {
    if (!dateVal) return false;
    const itemYMD = toBrazilYMD(dateVal);
    if (!itemYMD) return false;
    const now = new Date(); // Browser checks system time.
    const todayYMD = toBrazilYMD(now);
    
    switch (range) {
        case 'this-month': {
            const itemM = itemYMD.slice(0, 7);
            const targetM = todayYMD.slice(0, 7);
            return itemM === targetM;
        }
        return false;
    }
}

console.log("2026-02-08 is in this-month:", isDateInSelectedRange('2026-02-08', 'this-month'));
