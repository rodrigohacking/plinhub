
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIntegrations() {
    const integrations = await prisma.integration.findMany({
        include: { company: true }
    });

    console.log("Current Integrations:");
    integrations.forEach(i => {
        console.log(`ID: ${i.id} | Company: ${i.company.name} (${i.companyId}) | Type: ${i.type}`);
        console.log(`   PipeFy Pipe ID: ${i.pipefyPipeId}`);
        console.log(`   Is Active: ${i.isActive}`);
    });
}

checkIntegrations()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
