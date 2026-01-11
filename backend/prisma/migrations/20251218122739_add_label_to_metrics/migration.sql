-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Metric" (
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
INSERT INTO "new_Metric" ("avgCycleTime", "cardsByPhase", "cardsConverted", "cardsCreated", "cardsLost", "cardsQualified", "clicks", "companyId", "conversionRate", "conversions", "cpc", "cpm", "createdAt", "ctr", "date", "frequency", "id", "impressions", "metadata", "reach", "roas", "source", "spend") SELECT "avgCycleTime", "cardsByPhase", "cardsConverted", "cardsCreated", "cardsLost", "cardsQualified", "clicks", "companyId", "conversionRate", "conversions", "cpc", "cpm", "createdAt", "ctr", "date", "frequency", "id", "impressions", "metadata", "reach", "roas", "source", "spend" FROM "Metric";
DROP TABLE "Metric";
ALTER TABLE "new_Metric" RENAME TO "Metric";
CREATE INDEX "Metric_companyId_date_idx" ON "Metric"("companyId", "date");
CREATE INDEX "Metric_source_idx" ON "Metric"("source");
CREATE UNIQUE INDEX "Metric_companyId_date_source_label_key" ON "Metric"("companyId", "date", "source", "label");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
