-- Restore Andar Seguros Data manually
-- Company ID: 4072d04e-4110-495e-aa13-16fd41402264

INSERT INTO "Integration" ("companyId", "type", "pipefyOrgId", "pipefyPipeId", "pipefyToken", "settings", "isActive", "updatedAt")
VALUES (
    '4072d04e-4110-495e-aa13-16fd41402264', -- Andar Seguros UUID
    'pipefy',
    '300746108',
    '306438109',
    'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA',
    '{"wonPhase":"Fechamento - Ganho","wonPhaseId":"338889923","lostPhase":"Fechamento - Perdido","lostPhaseId":"338889931","qualifiedPhase":"","qualifiedPhaseId":"","valueField":"Valor Final do Prêmio","lossReasonField":"Motivo de Perda"}'::jsonb,
    true,
    now()
)
ON CONFLICT ("companyId", "type") 
DO UPDATE SET 
    "pipefyOrgId" = EXCLUDED."pipefyOrgId",
    "pipefyPipeId" = EXCLUDED."pipefyPipeId",
    "pipefyToken" = EXCLUDED."pipefyToken",
    "settings" = EXCLUDED."settings",
    "isActive" = true,
    "updatedAt" = now();
