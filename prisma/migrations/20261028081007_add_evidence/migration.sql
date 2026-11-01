-- CreateEnum
CREATE TYPE "EvidenceFaceStatus" AS ENUM ('PENDING', 'PROCESSED', 'NO_FACES', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceScreenStatus" AS ENUM ('PENDING', 'CLEAR', 'FLAGGED', 'REVIEW_REQUIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('NONE', 'PENDING', 'CLEARED', 'CONFIRMED_SENSITIVE');

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "faceCount" INTEGER NOT NULL DEFAULT 0,
    "faceStatus" "EvidenceFaceStatus" NOT NULL DEFAULT 'PENDING',
    "screenStatus" "EvidenceScreenStatus" NOT NULL DEFAULT 'PENDING',
    "screenCategory" TEXT,
    "screenScore" DOUBLE PRECISION,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'NONE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_storedName_key" ON "Evidence"("storedName");

-- CreateIndex
CREATE INDEX "Evidence_postId_idx" ON "Evidence"("postId");

-- CreateIndex
CREATE INDEX "Evidence_uploaderId_idx" ON "Evidence"("uploaderId");

-- CreateIndex
CREATE INDEX "Evidence_screenStatus_idx" ON "Evidence"("screenStatus");

-- CreateIndex
CREATE INDEX "Evidence_published_idx" ON "Evidence"("published");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
