-- CreateEnum
CREATE TYPE "AwaitingParty" AS ENUM ('NONE', 'INSTITUTION', 'BUREAU', 'REVIEWER');

-- CreateEnum
CREATE TYPE "CaseRelationType" AS ENUM ('RELATED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "RelationStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ComplaintEventType" ADD VALUE 'TRANSFERRED';
ALTER TYPE "ComplaintEventType" ADD VALUE 'NEXT_ACTION';
ALTER TYPE "ComplaintEventType" ADD VALUE 'RELATED_DECISION';
ALTER TYPE "ComplaintEventType" ADD VALUE 'OUTCOME_RECORDED';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "awaitingParty" "AwaitingParty" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "currentBureauId" TEXT,
ADD COLUMN     "deadlineBasis" TEXT,
ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionDueAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "type" TEXT;

-- CreateTable
CREATE TABLE "Bureau" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bureau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTransfer" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "fromBureauId" TEXT,
    "toBureauId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRelation" (
    "id" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "type" "CaseRelationType" NOT NULL DEFAULT 'RELATED',
    "status" "RelationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "reason" TEXT,
    "score" INTEGER,
    "createdById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bureau_name_key" ON "Bureau"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bureau_code_key" ON "Bureau"("code");

-- CreateIndex
CREATE INDEX "CaseTransfer_complaintId_idx" ON "CaseTransfer"("complaintId");

-- CreateIndex
CREATE INDEX "CaseTransfer_toBureauId_idx" ON "CaseTransfer"("toBureauId");

-- CreateIndex
CREATE INDEX "CaseRelation_aId_idx" ON "CaseRelation"("aId");

-- CreateIndex
CREATE INDEX "CaseRelation_bId_idx" ON "CaseRelation"("bId");

-- CreateIndex
CREATE INDEX "CaseRelation_status_idx" ON "CaseRelation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRelation_aId_bId_key" ON "CaseRelation"("aId", "bId");

-- CreateIndex
CREATE INDEX "Complaint_currentBureauId_idx" ON "Complaint"("currentBureauId");

-- CreateIndex
CREATE INDEX "Complaint_awaitingParty_idx" ON "Complaint"("awaitingParty");

-- CreateIndex
CREATE INDEX "Complaint_nextActionDueAt_idx" ON "Complaint"("nextActionDueAt");

-- CreateIndex
CREATE INDEX "Institution_state_idx" ON "Institution"("state");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_currentBureauId_fkey" FOREIGN KEY ("currentBureauId") REFERENCES "Bureau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_fromBureauId_fkey" FOREIGN KEY ("fromBureauId") REFERENCES "Bureau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_toBureauId_fkey" FOREIGN KEY ("toBureauId") REFERENCES "Bureau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTransfer" ADD CONSTRAINT "CaseTransfer_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_aId_fkey" FOREIGN KEY ("aId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_bId_fkey" FOREIGN KEY ("bId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRelation" ADD CONSTRAINT "CaseRelation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
