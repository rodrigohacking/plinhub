const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

/**
 * Delete a company and all its data
 * DELETE /api/companies/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Due to onDelete: Cascade in schema.prisma, this will also delete
        // metrics, integrations, and sync logs.
        await prisma.company.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true, message: 'Empresa e todos os dados relacionados foram excluídos.' });
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
