require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function findAndar() {
    console.log("🕵️‍♀️ Searching for 'Andar Seguros'...");

    try {
        const { data: companies, error } = await supabase
            .from('Company')
            .select('id, name')
            .ilike('name', '%andar%');

        if (error) {
            console.error("DB Error:", error);
            return;
        }

        console.log("Found Companies:");
        companies.forEach(c => console.log(`[${c.name}] ID: ${c.id}`));

    } catch (e) {
        console.error(e);
    }
}

findAndar();
