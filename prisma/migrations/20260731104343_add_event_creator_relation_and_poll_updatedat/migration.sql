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

-- ============================================================
-- IVFFLAT INDEX — READ BEFORE TOUCHING THIS BLOCK
-- ============================================================
-- PlayerEmbedding.embedding is declared as Unsupported("vector(768)")
-- in schema.prisma because Prisma has no native pgvector type.
-- Consequence: Prisma's shadow-DB diff cannot represent this index
-- in the DSL, so every `prisma migrate dev` run emits a DROP INDEX
-- for idx_player_embedding_cosine in the generated migration file.
--
-- RULE: any migration that contains DROP INDEX "idx_player_embedding_cosine"
-- MUST re-create it in the same file (as done below).
--
-- To detect regressions after deploy run:
--   pnpm db:check-index
--   (queries pg_indexes and exits 1 if the index is absent)
--
-- DO NOT run `prisma migrate dev --create-only` and apply without
-- reviewing the generated SQL for a stray DROP INDEX on this table.
-- ============================================================
CREATE INDEX idx_player_embedding_cosine
  ON "PlayerEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
