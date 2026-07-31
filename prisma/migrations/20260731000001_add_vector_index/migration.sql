-- Add ivfflat cosine index on PlayerEmbedding.embedding for pgvector similarity search.
-- Without this index every <=> query does a full sequential scan over all team embeddings.
--
-- lists=10: appropriate for up to ~1000 rows (rule of thumb: sqrt(n_rows)).
-- Raise to lists=100 when the table exceeds ~10k rows and run ANALYZE afterwards.
--
-- NOTE: For production tables with existing rows, run instead (outside a transaction):
--   CREATE INDEX CONCURRENTLY idx_player_embedding_cosine
--   ON "PlayerEmbedding" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_player_embedding_cosine
  ON "PlayerEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
