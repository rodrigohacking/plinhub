
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Token from the existing integration to reuse (assuming same user token works for both)
const TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";
const PIPE_ID_APOLAR = "305634232";
const COMPANY_NAME = "Apolar";

async function addApolar() {
    // 1. Create Company
    const newCompany = await prisma.company.create({
        data: {
            name: COMPANY_NAME,
            cnpj: "00000000000000", // dummy
        }
    });
    console.log(`Created Company: ${newCompany.name} (ID: ${newCompany.id})`);

    // 2. Create Integration
    const newIntegration = await prisma.integration.create({
        data: {
            companyId: newCompany.id,
            type: 'pipefy',
            pipefyPipeId: PIPE_ID_APOLAR,
            pipefyToken: TOKEN, // Reusing token
            isActive: true
        }
    });
    console.log(`Created Integration for Pipe: ${newIntegration.pipefyPipeId}`);
}

addApolar()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
