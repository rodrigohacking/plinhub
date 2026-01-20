const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function runRestoreApolar() {
    console.log("🔄 Running Restore for Apolar Condomínios...");

    // Apolar UUID
    const COMPANY_ID = '5b936bf7-39ab-4f19-b636-818d6281dbd8';

    // Config provided by user (Correct Apolar Pipe)
    const ORG_ID = '300746108';
    const PIPE_ID = '305634232';
    const TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA';

    // We reset settings because Phase IDs from that wrong Pipe (Andar's) won't match this Pipe (Apolar's)
    const settings = {
        wonPhase: "",
        wonPhaseId: "",
        lostPhase: "",
        lostPhaseId: "",
        qualifiedPhase: "",
        qualifiedPhaseId: "",
        valueField: "", // Should be re-selected
        lossReasonField: "" // Should be re-selected
    };

    const payload = {
        companyId: COMPANY_ID,
        type: 'pipefy',
        pipefyOrgId: ORG_ID,
        pipefyPipeId: PIPE_ID,
        pipefyToken: TOKEN,
        settings: settings,
        isActive: true, // It is active, but needs config
        updatedAt: new Date()
    };

    const { data, error } = await supabase
        .from('Integration')
        .upsert(payload, { onConflict: 'companyId, type' })
        .select();

    if (error) {
        console.error("❌ Error running restore:", error);
    } else {
        console.log("✅ Apolar Restore successful!", data);
    }
}

runRestoreApolar();
