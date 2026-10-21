-- CreateEnum
CREATE TYPE "BodyArea" AS ENUM ('HEAD', 'NECK', 'SHOULDER', 'ARM_ELBOW', 'WRIST_HAND', 'UPPER_BACK', 'LOWER_BACK', 'HIP_GROIN', 'THIGH', 'KNEE', 'CALF_LEG', 'ANKLE_FOOT', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "healthConsentAt" TIMESTAMP(3),
ADD COLUMN "healthConsentVersion" TEXT;

-- CreateTable
CREATE TABLE "Discomfort" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bodyArea" "BodyArea" NOT NULL,
    "intensity" INTEGER NOT NULL,
    "note" VARCHAR(280),
    "seenByCoachAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discomfort_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Discomfort_intensity_check" CHECK ("intensity" BETWEEN 0 AND 10)
);

-- CreateIndex
CREATE INDEX "Discomfort_eventId_idx" ON "Discomfort"("eventId");

-- CreateIndex
CREATE INDEX "Discomfort_userId_idx" ON "Discomfort"("userId");

-- AddForeignKey
ALTER TABLE "Discomfort" ADD CONSTRAINT "Discomfort_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discomfort" ADD CONSTRAINT "Discomfort_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
