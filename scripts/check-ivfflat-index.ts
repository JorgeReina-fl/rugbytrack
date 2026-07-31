/**
 * Post-deploy check: verifies idx_player_embedding_cosine exists in pg_indexes.
 *
 * WHY THIS EXISTS:
 * PlayerEmbedding.embedding uses Prisma's Unsupported("vector(768)") type.
 * Prisma cannot represent ivfflat indexes in its schema DSL, so every time
 * `prisma migrate dev` generates a new migration it diffs the shadow DB
 * against the Prisma schema and emits a DROP INDEX for this index.
 * The index is always manually re-added at the bottom of the migration SQL
 * that drops it. This script is the safety net: run it after every
 * `prisma migrate deploy` to catch any migration that forgets to restore it.
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm db:check-index
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'PlayerEmbedding'
      AND indexname = 'idx_player_embedding_cosine'
  `;

  if (rows.length === 0) {
    console.error(
      "FAIL: idx_player_embedding_cosine not found in pg_indexes.\n" +
        "A Prisma migration likely dropped it. Re-create with:\n\n" +
        '  CREATE INDEX idx_player_embedding_cosine\n' +
        '    ON "PlayerEmbedding"\n' +
        '    USING ivfflat (embedding vector_cosine_ops)\n' +
        '    WITH (lists = 10);\n'
    );
    process.exit(1);
  }

  console.log("OK: idx_player_embedding_cosine exists.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
