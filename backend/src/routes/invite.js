const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * POST /api/invites
 * Saves user to CompanyUser table AND sends a real Supabase auth invite email.
 * Body: { email, companyId, role, companyName }
 */
router.post('/', async (req, res) => {
    const { email, companyId, role, companyName } = req.body;

    if (!email || !companyId || !role) {
        return res.status(400).json({ error: 'Missing required fields: email, companyId, role' });
    }

    try {
        // 1. Upsert into CompanyUser table
        const { error: dbError } = await supabase
            .from('CompanyUser')
            .upsert(
                { companyId, email, role: role || 'viewer' },
                { onConflict: 'companyId,email' }
            );

        if (dbError) {
            console.error('CompanyUser upsert error:', dbError);
            // Non-fatal: continue with invite even if upsert has minor issues
        }

        // 2. Send real Supabase auth invite (creates user + sends email with magic link)
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: {
                companyId,
                companyName: companyName || 'PLIN HUB',
                role
            },
            redirectTo: process.env.FRONTEND_URL || 'http://localhost:5173'
        });

        if (inviteError) {
            // User might already exist — treat as soft error
            console.warn('Supabase invite warning:', inviteError.message);
            return res.json({
                success: true,
                message: `Acesso salvo. ${inviteError.message.includes('already') ? 'Usuário já possui conta.' : 'Email de convite não pôde ser enviado.'}`,
                warning: inviteError.message
            });
        }

        console.log(`[INVITE] Sent to ${email} for company ${companyName} (role: ${role})`);
        res.json({ success: true, message: `Convite enviado para ${email}` });
    } catch (error) {
        console.error('Error in invite route:', error);
        res.status(500).json({ error: error.message || 'Failed to send invitation' });
    }
});

module.exports = router;
