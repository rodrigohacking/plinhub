
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDec22() {
    const dateStr = "2025-12-22T00:00:00.000Z"; // Prisma stores as DateTime, ISO string in SQLite probably
    // Actually SQLite stores as number or string? Prisma adapter handles it.

    const metrics = await prisma.metric.findMany({
        where: {
            companyId: 2,
            date: new Date('2025-12-22'),
            source: 'pipefy'
        }
    });

    console.log("Metrics for 2025-12-22:");
    metrics.forEach(m => {
        if (m.cardsConverted > 0 || m.label === 'all') {
            console.log(`Label: ${m.label} | Converted: ${m.cardsConverted} | Created: ${m.cardsCreated} | Phases: ${m.cardsByPhase}`);
        }
    });
}

checkDec22()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
