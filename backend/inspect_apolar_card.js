
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('./src/utils/encryption');

async function inspectCard() {
    const cardId = "1241612009";

    // Get token from DB
    const integration = await prisma.integration.findFirst({
        where: { companyId: 2, type: 'pipefy' }
    });

    const token = decrypt(integration.pipefyToken);

    const query = `
    query {
      card(id: ${cardId}) {
        id
        title
        created_at
        updated_at
        finished_at
        current_phase { name }
      }
    }
  `;

    try {
        const res = await axios.post('https://api.pipefy.com/graphql', { query }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        console.log("Card Details:", JSON.stringify(res.data.data.card, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

inspectCard();
