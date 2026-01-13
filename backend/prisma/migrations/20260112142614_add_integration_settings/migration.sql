/*
  Warnings:

  - The primary key for the `Company` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Company` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `companyId` on the `Integration` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `companyId` on the `Metric` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `companyId` on the `SyncLog` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "photo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" BIGINT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "logo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Company" ("cnpj", "createdAt", "id", "logo", "name", "updatedAt") SELECT "cnpj", "createdAt", "id", "logo", "name", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE TABLE "new_Integration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" BIGINT NOT NULL,
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
    "settings" TEXT,
    "lastSync" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Integration" ("companyId", "createdAt", "id", "isActive", "lastSync", "metaAccessToken", "metaAccountName", "metaAdAccountId", "metaBusinessId", "metaStatus", "metaTokenExpiry", "pipefyOrgId", "pipefyPipeId", "pipefyToken", "type", "updatedAt") SELECT "companyId", "createdAt", "id", "isActive", "lastSync", "metaAccessToken", "metaAccountName", "metaAdAccountId", "metaBusinessId", "metaStatus", "metaTokenExpiry", "pipefyOrgId", "pipefyPipeId", "pipefyToken", "type", "updatedAt" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
CREATE INDEX "Integration_companyId_idx" ON "Integration"("companyId");
CREATE UNIQUE INDEX "Integration_companyId_type_key" ON "Integration"("companyId", "type");
CREATE TABLE "new_Metric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" BIGINT NOT NULL,
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
    "cardsQualified" INTEGER,
    "cardsConverted" INTEGER,
    "cardsLost" INTEGER,
    "avgCycleTime" REAL,
    "conversionRate" REAL,
    "cardsByPhase" TEXT,
    "label" TEXT NOT NULL DEFAULT 'all',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Metric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Metric" ("avgCycleTime", "cardsByPhase", "cardsConverted", "cardsCreated", "cardsLost", "cardsQualified", "clicks", "companyId", "conversionRate", "conversions", "cpc", "cpm", "createdAt", "ctr", "date", "frequency", "id", "impressions", "label", "metadata", "reach", "roas", "source", "spend") SELECT "avgCycleTime", "cardsByPhase", "cardsConverted", "cardsCreated", "cardsLost", "cardsQualified", "clicks", "companyId", "conversionRate", "conversions", "cpc", "cpm", "createdAt", "ctr", "date", "frequency", "id", "impressions", "label", "metadata", "reach", "roas", "source", "spend" FROM "Metric";
DROP TABLE "Metric";
ALTER TABLE "new_Metric" RENAME TO "Metric";
CREATE INDEX "Metric_companyId_date_idx" ON "Metric"("companyId", "date");
CREATE INDEX "Metric_source_idx" ON "Metric"("source");
CREATE UNIQUE INDEX "Metric_companyId_date_source_label_key" ON "Metric"("companyId", "date", "source", "label");
CREATE TABLE "new_SyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" BIGINT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "errorDetails" TEXT,
    "duration" INTEGER,
    "recordsProcessed" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SyncLog" ("companyId", "createdAt", "duration", "errorDetails", "id", "message", "recordsProcessed", "source", "status") SELECT "companyId", "createdAt", "duration", "errorDetails", "id", "message", "recordsProcessed", "source", "status" FROM "SyncLog";
DROP TABLE "SyncLog";
ALTER TABLE "new_SyncLog" RENAME TO "SyncLog";
CREATE INDEX "SyncLog_companyId_createdAt_idx" ON "SyncLog"("companyId", "createdAt");
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CompanyUser_companyId_idx" ON "CompanyUser"("companyId");

-- CreateIndex
CREATE INDEX "CompanyUser_userId_idx" ON "CompanyUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_companyId_email_key" ON "CompanyUser"("companyId", "email");
