-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('SEVENS', 'FIFTEENS');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "format" "MatchFormat";

-- AlterTable
ALTER TABLE "Callup" ADD COLUMN "shirtNumber" INTEGER;

-- AddCheck (not modelled by Prisma)
ALTER TABLE "Callup" ADD CONSTRAINT "Callup_shirtNumber_check" CHECK ("shirtNumber" IS NULL OR "shirtNumber" BETWEEN 1 AND 23);

-- CreateIndex
CREATE UNIQUE INDEX "Callup_eventId_shirtNumber_key" ON "Callup"("eventId", "shirtNumber");
