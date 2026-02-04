const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

// POST /api/goals - UPSERT a goal for a company/month
router.post('/', async (req, res) => {
    try {
        const { companyId, month: monthStr, revenue, deals, leads } = req.body;

        if (!companyId || !monthStr) {
            return res.status(400).json({ error: 'Missing companyId or month' });
        }

        console.log(`🎯 Setting Goal for ${companyId} - ${monthStr}:`, { revenue, deals, leads });

        // Parse YYYY-MM
        const [yearStr, mStr] = monthStr.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(mStr);

        // Map to DB Schema (Snake Case)
        // Schema: company_id, year, month, sales_goal, sales_count_goal, leads_goal
        const payload = {
            company_id: companyId,
            year: year,
            month: month,
            sales_goal: parseFloat(revenue) || 0,
            sales_count_goal: parseInt(deals) || 0,
            leads_goal: parseInt(leads) || 0
        };

        // Use UPSERT on conflict (company_id, year, month)
        // Note: We need to ensure the DB has this unique constraint. 
        // If not, we might create duplicates. 
        // But since we can't easily add constraints via code here without migration,
        // Let's try to check existing first to be safe, THEN upsert or update.
        // Actually, let's look for existing by company_id, year, month.

        const { data: existing } = await supabase
            .from('goals')
            .select('id')
            .eq('company_id', companyId)
            .eq('year', year)
            .eq('month', month)
            .maybeSingle(); // maybeSingle returns null if not found, doesn't throw

        let result;
        if (existing) {
            result = await supabase
                .from('goals')
                .update(payload)
                .eq('id', existing.id)
                .select();
        } else {
            result = await supabase
                .from('goals')
                .insert([payload])
                .select();
        }

        if (result.error) throw result.error;

        console.log("✅ Goal saved:", result.data);
        res.json({ success: true, data: result.data });

    } catch (error) {
        console.error("❌ Error saving goal:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
