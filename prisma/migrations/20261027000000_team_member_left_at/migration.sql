-- TeamMember.leftAt (soft-delete de miembros, add6aca).
-- Idempotente: producción ya tiene columna e índice, aplicados fuera de migraciones.
-- idx_player_embedding_cosine (pgvector, 20260731000001) no lo modela Prisma: nunca incluir su DROP en una migración.
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_leftAt_idx" ON "TeamMember"("teamId", "leftAt");
