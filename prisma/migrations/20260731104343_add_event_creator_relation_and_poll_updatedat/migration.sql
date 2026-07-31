/*
  Warnings:

  - You are about to drop the `Play` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Poll` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Play" DROP CONSTRAINT "Play_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Play" DROP CONSTRAINT "Play_teamId_fkey";

-- DropIndex
DROP INDEX "idx_player_embedding_cosine";

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "Play";

-- DropEnum
DROP TYPE "PlayCategory";

-- CreateIndex
CREATE INDEX "Event_createdById_idx" ON "Event"("createdById");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restore ivfflat index dropped above (Prisma can't track indexes on Unsupported columns)
CREATE INDEX idx_player_embedding_cosine
  ON "PlayerEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
