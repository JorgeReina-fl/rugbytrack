-- AlterTable
ALTER TABLE "RpeEntry" ADD COLUMN "recordedById" TEXT;
ALTER TABLE "RpeEntry" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: las entradas existentes las registró el propio jugador
UPDATE "RpeEntry" SET "recordedById" = "userId" WHERE "recordedById" IS NULL;

-- CreateIndex
CREATE INDEX "RpeEntry_recordedById_idx" ON "RpeEntry"("recordedById");

-- AddForeignKey
ALTER TABLE "RpeEntry" ADD CONSTRAINT "RpeEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
