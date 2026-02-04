const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

/**
 * Get campaigns for a company
 * GET /api/campaigns/:companyId
 */
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { range = '90d' } = req.query;

        console.log(`Getting campaigns for company ${companyId} (Range: ${range})`);

        // Calculate date range
        const days = parseInt(range.replace('d', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString();

        // Check if companyId is UUID or Name
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);

        let effectiveId = companyId;

        if (!isUuid) {
            const { data: companyData } = await supabase.from('Company')
                .select('id')
                .or(`name.ilike.%${companyId}%,name.ilike.%${decodeURIComponent(companyId)}%`)
                .limit(1)
                .single();

            if (companyData) effectiveId = companyData.id;
            else return res.status(404).json({ error: 'Company not found' });
        }

        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('company_id', effectiveId)
            .gte('start_date', startDateStr)
            .order('start_date', { ascending: false });

        if (error) throw new Error(error.message);

        res.json(campaigns || []);

    } catch (error) {
        console.error("Error fetching campaigns:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
