-- AlterTable: add proposalId FK to Event for proposal→event traceability
ALTER TABLE "Event" ADD COLUMN "proposalId" TEXT;

-- CreateIndex
CREATE INDEX "Event_proposalId_idx" ON "Event"("proposalId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
