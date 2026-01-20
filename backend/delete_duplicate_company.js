const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function deleteDuplicate() {
    console.log("🗑 Removing duplicate company 'Andar Seguross'...");

    // Hardcoded ID from previous check
    const duplicateId = 'f3f52091-2b44-4567-9ada-5d51ba5de28e';

    const { error } = await supabase.from('Company').delete().eq('id', duplicateId);

    if (error) console.error("❌ Error deleting:", error.message);
    else console.log("✅ Successfully deleted duplicate company.");
}

deleteDuplicate();
