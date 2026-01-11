
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('./src/utils/encryption');

async function checkSize() {
    const integration = await prisma.integration.findFirst({
        where: { companyId: 2, type: 'pipefy' }
    });
    const token = decrypt(integration.pipefyToken);
    const pipeId = integration.pipefyPipeId; // 305634232

    const query = `
    query {
      pipe(id: ${pipeId}) {
        phases {
          name
          cards_count
        }
      }
    }
  `;

    try {
        const res = await axios.post('https://api.pipefy.com/graphql', { query }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        let total = 0;
        res.data.data.pipe.phases.forEach(p => {
            console.log(`${p.name}: ${p.cards_count}`);
            total += p.cards_count;
        });
        console.log(`TOTAL CARDS: ${total}`);
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkSize();
