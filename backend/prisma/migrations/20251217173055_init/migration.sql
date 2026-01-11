-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "logo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "pipefyOrgId" TEXT,
    "pipefyPipeId" TEXT,
    "pipefyToken" TEXT,
    "metaAdAccountId" TEXT,
    "metaAccessToken" TEXT,
    "metaBusinessId" TEXT,
    "metaAccountName" TEXT,
    "metaTokenExpiry" DATETIME,
    "metaStatus" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "spend" REAL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "conversions" INTEGER,
    "roas" REAL,
    "cpc" REAL,
    "cpm" REAL,
    "ctr" REAL,
    "reach" INTEGER,
    "frequency" REAL,
    "cardsCreated" INTEGER,
    "cardsConverted" INTEGER,
    "avgCycleTime" REAL,
    "conversionRate" REAL,
    "cardsByPhase" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Metric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "errorDetails" TEXT,
    "duration" INTEGER,
    "recordsProcessed" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Integration_companyId_idx" ON "Integration"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_companyId_type_key" ON "Integration"("companyId", "type");

-- CreateIndex
CREATE INDEX "Metric_companyId_date_idx" ON "Metric"("companyId", "date");

-- CreateIndex
CREATE INDEX "Metric_source_idx" ON "Metric"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Metric_companyId_date_source_key" ON "Metric"("companyId", "date", "source");

-- CreateIndex
CREATE INDEX "SyncLog_companyId_createdAt_idx" ON "SyncLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
