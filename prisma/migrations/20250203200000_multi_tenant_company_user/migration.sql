-- CreateEnum
CREATE TYPE "CompanyUserRole" AS ENUM ('OWNER', 'CONTADOR', 'AUXILIAR_CONTABLE', 'AUDITOR', 'CAJERO', 'EMPLEADO');

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyUserRole" NOT NULL DEFAULT 'EMPLEADO',
    "permissions" TEXT,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUser_pkey" PRIMARY KEY ("id")
);

-- Migrate existing User data to CompanyUser (userId, companyId, role from User)
INSERT INTO "CompanyUser" ("id", "userId", "companyId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, u."companyId", (u.role::text)::"CompanyUserRole", u."createdAt", u."updatedAt"
FROM "User" u;

-- AlterTable User: add isSuperAdmin, then drop companyId and role
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" DROP COLUMN "companyId";
ALTER TABLE "User" DROP COLUMN "role";

-- Drop unique (email, companyId) and create unique (email)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_companyId_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_userId_companyId_key" ON "CompanyUser"("userId", "companyId");
CREATE INDEX "CompanyUser_companyId_idx" ON "CompanyUser"("companyId");
CREATE INDEX "CompanyUser_userId_idx" ON "CompanyUser"("userId");

-- AddForeignKey
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
