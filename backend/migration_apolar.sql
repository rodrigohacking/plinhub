-- 1. Disable RLS and Drop Tables
-- ALTER TABLE "Integration" DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS "Metric" CASCADE;
DROP TABLE IF EXISTS "SyncLog" CASCADE;
DROP TABLE IF EXISTS "Integration" CASCADE;

-- 2. Recreate Integration Table
CREATE TABLE "Integration" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" uuid NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "type" text NOT NULL, -- 'pipefy', 'meta_ads'
    "pipefyOrgId" text,
    "pipefyPipeId" text,
    "pipefyToken" text,
    "metaAdAccountId" text,
    "metaAccountName" text,
    "metaAccessToken" text,
    "metaBusinessId" text,
    "metaStatus" text,
    "metaTokenExpiry" timestamp with time zone,
    "settings" jsonb,
    "isActive" boolean DEFAULT true,
    "lastSync" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    UNIQUE("companyId", "type")
);

-- 3. Recreate Metric Table
CREATE TABLE "Metric" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" uuid NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "source" text NOT NULL,
    "date" date NOT NULL,
    "label" text NOT NULL,
    "cardsCreated" integer DEFAULT 0,
    "cardsQualified" integer DEFAULT 0,
    "cardsConverted" integer DEFAULT 0,
    "cardsLost" integer DEFAULT 0,
    "conversionRate" numeric(10,2),
    "cardsByPhase" jsonb,
    "spend" numeric(10,2),
    "impressions" integer,
    "clicks" integer,
    "conversions" integer,
    "roas" numeric(10,2),
    "cpc" numeric(10,2),
    "cpm" numeric(10,2),
    "ctr" numeric(10,2),
    "reach" integer,
    "frequency" numeric(10,2),
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    UNIQUE("companyId", "date", "source", "label")
);

-- 4. Recreate SyncLog Table
CREATE TABLE "SyncLog" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" uuid NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "source" text NOT NULL,
    "status" text NOT NULL,
    "message" text,
    "recordsProcessed" integer DEFAULT 0,
    "duration" integer,
    "createdAt" timestamp with time zone DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Metric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncLog" ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions (Assuming service role bypasses, but good hygiene)
GRANT ALL ON "Integration" TO service_role;
GRANT ALL ON "Metric" TO service_role;
GRANT ALL ON "SyncLog" TO service_role;
-- Public/Authenticated read access policies might be needed if frontend reads directly?
-- For now, relying on API.

-- 7. Restore Apolar Data
-- Pipefy Integration
INSERT INTO "Integration" ("companyId", "type", "pipefyOrgId", "pipefyPipeId", "pipefyToken", "settings", "isActive", "updatedAt")
VALUES (
    '5b936bf7-39ab-4f19-b636-818d6281dbd8', -- Apolar UUID
    'pipefy',
    '300746108',
    '306438109',
    'U2FsdGVkX1/UrHE4NHvkYP3e+aios+rkJTyKWWzgQnxlV0h4ycmZBzldCkh2H04vJdhDv3BehnasEg6wfPIK4IGx2FFuzi32ozu+FAGfZrLPNFWSapszAfjOoUJNC8GfFlqUz9ThQLF6XCbgSzc+JCP0fThbdaViGYw3QQmB9mXyA2lUtjJpFF9G6q5996urFOunXh3gdqdH63Jlw/fTFkBehyCFjrMuifv5vcuXzB650iNqk5KEEaLjJyQP1Jq9TXyUmeBe5AIK1mygbG8vhNmjbdnAYdMoLT0Tmd9gw6xvJNg1YssfMwRXqWiO6tXmzn/12TUQ1d9H0iVmbNOKw0vMmylfcMEiObnnRhYgNQQa/8+ZL5s6eqgiG6S5sEsyJp3jBUuRgVPQX1E1SnboSy8w4G3Lh126HAvcb9auRFRSLD6pQJaUokpTSPXgIFPup/BguE9O6TkDPQpcYA9xHJLr+jn38aV6xRxbTO7VdSTDLNfroONqGcmGVAdHDmhf',
    '{"wonPhase":"Fechamento - Ganho","wonPhaseId":"338889923","lostPhase":"Fechamento - Perdido","lostPhaseId":"338889931","qualifiedPhase":"","qualifiedPhaseId":"","valueField":"Valor Final do Prêmio","lossReasonField":"Motivo de Perda"}'::jsonb,
    true,
    now()
);

-- Meta Ads Integration
INSERT INTO "Integration" ("companyId", "type", "metaAdAccountId", "metaAccessToken", "isActive", "updatedAt", "settings")
VALUES (
    '5b936bf7-39ab-4f19-b636-818d6281dbd8', -- Apolar UUID
    'meta_ads',
    '631649546531729',
    'U2FsdGVkX18oQEThVvVFrZisKjT5qMFYpEeh4tv8LPOiby+k5StL10RFCHj39v4cpIRuBxlLWIiMNRQUoA4SbplAu+kZ9RZyt2NFrKWatJymG5RrlZcJo5fOlqss2EC3q0aaQPcfSElc3CG2oZjBWzdee6EXSOCE6DORuz3i/LacuzZ8FksUvM567T2Gnz/15U4dB9yjqjR4Bl+GFEPahsDYoy50i1maY1gN2DudOleUPD92wfL8iNygeV4rCPTU66IAnvJVGrZAlgFRKzdEgV2jxmle/SK9gKCVjxMS4aw=',
    true,
    now(),
    null
);
