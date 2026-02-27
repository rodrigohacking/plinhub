const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

/**
 * GET /api/sales/:companyId
 * Returns deals from the `sales` table for a company, within a date range.
 */
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { range = '90d', startDate, endDate } = req.query;

        // Check if companyId is UUID or Name
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
