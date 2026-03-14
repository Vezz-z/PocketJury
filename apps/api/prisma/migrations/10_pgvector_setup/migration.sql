-- ==============================================================================
-- PocketJury Supplementary SQL Migration
-- Run AFTER Prisma migrations to add pgvector columns and indexes
-- ==============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add vector column to document_embeddings (Prisma does not natively support vector type)
ALTER TABLE document_embeddings
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Create HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create full-text search index on legal documents
ALTER TABLE legal_documents
  ADD COLUMN IF NOT EXISTS body_text_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', body_text)) STORED;

CREATE INDEX IF NOT EXISTS idx_legal_documents_fts
  ON legal_documents
  USING gin (body_text_tsv);

-- Create full-text search index on title
ALTER TABLE legal_documents
  ADD COLUMN IF NOT EXISTS title_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title)) STORED;

CREATE INDEX IF NOT EXISTS idx_legal_documents_title_fts
  ON legal_documents
  USING gin (title_tsv);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_legal_docs_act_section
  ON legal_documents (act_name, section_number)
  WHERE effective_until IS NULL AND is_repealed = false;

CREATE INDEX IF NOT EXISTS idx_legal_docs_current
  ON legal_documents (document_type, year DESC)
  WHERE effective_until IS NULL AND is_repealed = false;

-- Function for hybrid search (vector + full-text with RRF)
CREATE OR REPLACE FUNCTION hybrid_legal_search(
  query_embedding vector(1024),
  query_text text,
  result_limit int DEFAULT 5,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  document_id uuid,
  chunk_text text,
  chunk_index int,
  act_name text,
  section_number text,
  document_type text,
  title text,
  effective_from date,
  source_url text,
  rrf_score float
) AS $$
WITH vector_results AS (
  SELECT
    de.document_id,
    de.chunk_text,
    de.chunk_index,
    ld.act_name,
    ld.section_number,
    ld.document_type::text,
    ld.title,
    ld.effective_from,
    ld.source_url,
    ROW_NUMBER() OVER (ORDER BY de.embedding <=> query_embedding) as rank
  FROM document_embeddings de
  JOIN legal_documents ld ON de.document_id = ld.id
  WHERE ld.effective_until IS NULL
    AND ld.is_repealed = false
  ORDER BY de.embedding <=> query_embedding
  LIMIT 20
),
fts_results AS (
  SELECT
    ld.id as document_id,
    ld.body_text as chunk_text,
    0 as chunk_index,
    ld.act_name,
    ld.section_number,
    ld.document_type::text,
    ld.title,
    ld.effective_from,
    ld.source_url,
    ROW_NUMBER() OVER (ORDER BY ts_rank(ld.body_text_tsv, plainto_tsquery('english', query_text)) DESC) as rank
  FROM legal_documents ld
  WHERE ld.body_text_tsv @@ plainto_tsquery('english', query_text)
    AND ld.effective_until IS NULL
    AND ld.is_repealed = false
  ORDER BY ts_rank(ld.body_text_tsv, plainto_tsquery('english', query_text)) DESC
  LIMIT 10
),
combined AS (
  SELECT
    document_id, chunk_text, chunk_index, act_name, section_number,
    document_type, title, effective_from, source_url,
    COALESCE(1.0 / (rrf_k + vr.rank), 0) + COALESCE(1.0 / (rrf_k + fr.rank), 0) as rrf_score
  FROM vector_results vr
  FULL OUTER JOIN fts_results fr USING (document_id, chunk_text, chunk_index, act_name, section_number, document_type, title, effective_from, source_url)
)
SELECT * FROM combined
ORDER BY rrf_score DESC
LIMIT result_limit;
$$ LANGUAGE sql STABLE;
