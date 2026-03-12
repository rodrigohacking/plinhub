const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { parseDateRange } = require('../utils/dateRange');

/**
 * GET /api/sales/:companyId
 * Returns deals from the `sales` table for a company, within a date range.
 */
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { range = '30d', tag = 'all' } = req.query;

        // 1. Get Company ID (Handles UUID or Name)
        let company;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);

        if (isUuid) {
            const { data } = await supabase.from('Company').select('id, name').eq('id', companyId).single();
            company = data;
        } else {
            const { data } = await supabase.from('Company')
                .select('id, name')
                .or(`name.ilike.%${companyId}%,name.ilike.%${decodeURIComponent(companyId)}%`)
                .limit(1)
                .single();
            company = data;
        }

        if (!company) {
            return res.status(404).json({ error: `Empresa '${companyId}' não encontrada.` });
        }

        const effectiveId = company.id;

        // 2. Parse Date Range (BRT-correct)
        const { startDate } = parseDateRange(range);

        // 3. Fetch Sales
        // We use a 180-day lookback buffer so that deals created BEFORE the selected range
        // but WON within it are included. The frontend filters by wonDate/date as needed.
        const BUFFER_DAYS = 180;
        const bufferedStart = new Date(startDate.getTime() - BUFFER_DAYS * 24 * 60 * 60 * 1000);

        let query = supabase
            .from('sales')
            .select('*')
            .eq('company_id', effectiveId)
            .gte('date', bufferedStart.toISOString())
            .order('date', { ascending: false })
            .limit(5000);

        const { data: sales, error } = await query;

        if (error) throw error;

        res.json(sales || []);
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
