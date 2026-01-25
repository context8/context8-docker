-- Initialize PostgreSQL database with required extensions
-- This script runs automatically when the Docker container starts

-- Enable citext extension for case-insensitive text
CREATE EXTENSION IF NOT EXISTS citext;

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Database extensions initialized successfully';
END $$;
