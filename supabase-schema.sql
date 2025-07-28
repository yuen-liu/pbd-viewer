-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create PDB entries table
CREATE TABLE pdb_entries (
  id BIGSERIAL PRIMARY KEY,
  pdb_id VARCHAR(10) UNIQUE NOT NULL,
  protein_name TEXT NOT NULL,
  organism TEXT,
  resolution DECIMAL(5,2),
  method VARCHAR(100),
  release_date TIMESTAMPTZ,
  structure_title TEXT,
  molecular_weight DECIMAL(10,2),
  keywords TEXT[], -- Array of keywords
  classification TEXT,
  authors TEXT[], -- Array of authors
  
  -- Full-text search vector (inverted index)
  search_vector TSVECTOR,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user bookmarks table
CREATE TABLE user_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  pdb_id VARCHAR(10) NOT NULL REFERENCES pdb_entries(pdb_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique bookmarks per user
  UNIQUE(user_id, pdb_id)
);

-- Create inverted indices for fast search
-- 1. GIN index for full-text search (inverted index for text search)
CREATE INDEX idx_pdb_search_vector ON pdb_entries USING GIN(search_vector);

-- 2. GIN index for keyword arrays (inverted index for array search)
CREATE INDEX idx_pdb_keywords ON pdb_entries USING GIN(keywords);

-- 3. GIN index for authors arrays
CREATE INDEX idx_pdb_authors ON pdb_entries USING GIN(authors);

-- 4. B-tree indices for exact matches and sorting
CREATE INDEX idx_pdb_id ON pdb_entries(pdb_id);
CREATE INDEX idx_pdb_organism ON pdb_entries(organism);
CREATE INDEX idx_pdb_method ON pdb_entries(method);
CREATE INDEX idx_pdb_classification ON pdb_entries(classification);
CREATE INDEX idx_pdb_resolution ON pdb_entries(resolution);
CREATE INDEX idx_pdb_release_date ON pdb_entries(release_date);

-- 5. Trigram indices for fuzzy string matching (inverted index for partial matches)
CREATE INDEX idx_pdb_protein_name_trgm ON pdb_entries USING GIN(protein_name gin_trgm_ops);
CREATE INDEX idx_pdb_organism_trgm ON pdb_entries USING GIN(organism gin_trgm_ops);
CREATE INDEX idx_pdb_classification_trgm ON pdb_entries USING GIN(classification gin_trgm_ops);

-- 6. Composite indices for common query patterns
CREATE INDEX idx_pdb_method_resolution ON pdb_entries(method, resolution);
CREATE INDEX idx_pdb_organism_method ON pdb_entries(organism, method);

-- 7. Index for user bookmarks
CREATE INDEX idx_user_bookmarks_user_id ON user_bookmarks(user_id);
CREATE INDEX idx_user_bookmarks_pdb_id ON user_bookmarks(pdb_id);

-- Function to automatically update search_vector (inverted index)
CREATE OR REPLACE FUNCTION update_pdb_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.pdb_id, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.protein_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.structure_title, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.organism, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.classification, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.authors, ' '), '')), 'D');
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_vector on insert/update
CREATE TRIGGER trigger_update_pdb_search_vector
  BEFORE INSERT OR UPDATE ON pdb_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_pdb_search_vector();

-- Function for advanced search with ranking
CREATE OR REPLACE FUNCTION search_pdb_entries(
  search_query TEXT,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  id BIGINT,
  pdb_id VARCHAR(10),
  protein_name TEXT,
  organism TEXT,
  resolution DECIMAL(5,2),
  method VARCHAR(100),
  release_date TIMESTAMPTZ,
  structure_title TEXT,
  molecular_weight DECIMAL(10,2),
  keywords TEXT[],
  classification TEXT,
  authors TEXT[],
  search_rank REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.pdb_id,
    p.protein_name,
    p.organism,
    p.resolution,
    p.method,
    p.release_date,
    p.structure_title,
    p.molecular_weight,
    p.keywords,
    p.classification,
    p.authors,
    ts_rank(p.search_vector, plainto_tsquery('english', search_query)) AS search_rank,
    p.created_at,
    p.updated_at
  FROM pdb_entries p
  WHERE p.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY search_rank DESC, p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Function for fuzzy search using trigrams
CREATE OR REPLACE FUNCTION fuzzy_search_pdb_entries(
  search_query TEXT,
  similarity_threshold REAL DEFAULT 0.3,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
  id BIGINT,
  pdb_id VARCHAR(10),
  protein_name TEXT,
  organism TEXT,
  resolution DECIMAL(5,2),
  method VARCHAR(100),
  release_date TIMESTAMPTZ,
  structure_title TEXT,
  molecular_weight DECIMAL(10,2),
  keywords TEXT[],
  classification TEXT,
  authors TEXT[],
  similarity_score REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.pdb_id,
    p.protein_name,
    p.organism,
    p.resolution,
    p.method,
    p.release_date,
    p.structure_title,
    p.molecular_weight,
    p.keywords,
    p.classification,
    p.authors,
    GREATEST(
      similarity(p.protein_name, search_query),
      similarity(p.organism, search_query),
      similarity(p.classification, search_query)
    ) AS similarity_score,
    p.created_at,
    p.updated_at
  FROM pdb_entries p
  WHERE 
    similarity(p.protein_name, search_query) > similarity_threshold OR
    similarity(p.organism, search_query) > similarity_threshold OR
    similarity(p.classification, search_query) > similarity_threshold
  ORDER BY similarity_score DESC, p.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) policies
ALTER TABLE pdb_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read PDB entries
CREATE POLICY "PDB entries are publicly readable" ON pdb_entries
  FOR SELECT USING (true);

-- Policy: Users can only access their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON user_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON user_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON user_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for RLS (removed problematic auth.uid() predicate)
-- The regular user_id index above is sufficient for RLS performance
