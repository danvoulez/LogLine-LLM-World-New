-- Enable pgvector extension for Vercel Postgres (Neon)
-- Run this in Vercel Dashboard → Storage → Your Database → Query tab

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

