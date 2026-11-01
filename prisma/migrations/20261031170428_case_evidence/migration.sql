-- CreateEnum
CREATE TYPE "CaseEvidenceStatus" AS ENUM ('RECEIVED', 'REVIEWED', 'NEEDS_CLARIFICATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ComplaintEventType" ADD VALUE 'EVIDENCE_ADDED';
ALTER TYPE "ComplaintEventType" ADD VALUE 'EVIDENCE_REVIEWED';

-- CreateTable
CREATE TABLE "ComplaintEvidence" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "source" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "CaseEvidenceStatus" NOT NULL DEFAULT 'RECEIVED',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintEvidence_storedName_key" ON "ComplaintEvidence"("storedName");

-- CreateIndex
CREATE INDEX "ComplaintEvidence_complaintId_idx" ON "ComplaintEvidence"("complaintId");

-- CreateIndex
CREATE INDEX "ComplaintEvidence_uploaderId_idx" ON "ComplaintEvidence"("uploaderId");

-- AddForeignKey
ALTER TABLE "ComplaintEvidence" ADD CONSTRAINT "ComplaintEvidence_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEvidence" ADD CONSTRAINT "ComplaintEvidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEvidence" ADD CONSTRAINT "ComplaintEvidence_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
