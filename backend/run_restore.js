const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');
const fs = require('fs');

async function runRestore() {
    console.log("🔄 Running Restore for Andar Seguros...");

    // Read the SQL file
    const sqlPath = path.resolve(__dirname, 'restore_andar.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error("❌ SQL file not found:", sqlPath);
        return;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Supabase JS 'rpc' or direct query via 'pg' is needed for raw SQL
    // But since supabase-js doesn't support raw SQL directly easily without RPC,
    // we will use the 'Integration' table update via JS object instead to be safe and easy.

    // Credentials from the user
    const COMPANY_ID = '4072d04e-4110-495e-aa13-16fd41402264';
    const PIPE_ID = '306438109';
    const ORG_ID = '300746108';
    const TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';

    const settings = {
        wonPhase: "Fechamento - Ganho",
        wonPhaseId: "338889923",
        lostPhase: "Fechamento - Perdido",
        lostPhaseId: "338889931",
        qualifiedPhase: "",
        qualifiedPhaseId: "",
        valueField: "Valor Final do Prêmio",
        lossReasonField: "Motivo de Perda"
    };

    const payload = {
        companyId: COMPANY_ID,
        type: 'pipefy', // Must match database constraint
        pipefyOrgId: ORG_ID,
        pipefyPipeId: PIPE_ID,
        pipefyToken: TOKEN,
        settings: settings,
        isActive: true,
        updatedAt: new Date()
    };

    const { data, error } = await supabase
        .from('Integration')
        .upsert(payload, { onConflict: 'companyId, type' })
        .select();

    if (error) {
        console.error("❌ Error running restore:", error);
    } else {
        console.log("✅ Restore successful!", data);
    }
}

runRestore();
