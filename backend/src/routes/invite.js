const express = require('express');
const router = express.Router();

/**
 * POST /api/invite
 * Sends an email invitation to a user.
 * Body: { email, companyId, role, companyName }
 */
router.post('/', async (req, res) => {
    const { email, companyId, role, companyName } = req.body;

    if (!email || !companyId || !role) {
        return res.status(400).json({ error: 'Missing required fields: email, companyId, role' });
    }

    try {
        // SIMULATION: Sending email
        console.log(`\n--- [MOCK EMAIL SERVICE] ---`);
        console.log(`To: ${email}`);
        console.log(`Subject: Convite para acessar ${companyName || 'PLIN HUB'}`);
        console.log(`Body:`);
        console.log(`Olá,`);
        console.log(`Você foi convidado para acessar a organização ${companyName || 'no PLIN HUB'} com o perfil de acesso: ${role.toUpperCase()}.`);
        console.log(`Acesse o sistema para continuar.`);
        console.log(`--- [END MOCK EMAIL] ---\n`);

        // In a real implementation, we would use Resend or Nodemailer here.
        // await resend.emails.send({ ... });

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        res.json({ success: true, message: 'Invite sent successfully (Mock)' });
    } catch (error) {
        console.error('Error sending invite:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

module.exports = router;
