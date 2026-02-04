-- CreateTable
CREATE TABLE "AccountingJournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentId" TEXT,
    "date" DATE NOT NULL,
    "totalDebit" DECIMAL(18,2) NOT NULL,
    "totalCredit" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAccountMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "CompanyAccountMapping_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN "journalEntryId" TEXT;

-- CreateIndex
CREATE INDEX "AccountingJournalEntry_companyId_idx" ON "AccountingJournalEntry"("companyId");

-- CreateIndex
CREATE INDEX "AccountingJournalEntry_companyId_date_idx" ON "AccountingJournalEntry"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAccountMapping_companyId_accountKey_key" ON "CompanyAccountMapping"("companyId", "accountKey");

-- CreateIndex
CREATE INDEX "CompanyAccountMapping_companyId_idx" ON "CompanyAccountMapping"("companyId");

-- CreateIndex
CREATE INDEX "AccountingEntry_journalEntryId_idx" ON "AccountingEntry"("journalEntryId");

-- AddForeignKey
ALTER TABLE "AccountingJournalEntry" ADD CONSTRAINT "AccountingJournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAccountMapping" ADD CONSTRAINT "CompanyAccountMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAccountMapping" ADD CONSTRAINT "CompanyAccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "AccountingJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
