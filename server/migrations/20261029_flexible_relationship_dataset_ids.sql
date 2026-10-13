-- ============================================================================
-- Migration: Flexible Relationship Dataset IDs (Supporting UUIDs & Integers)
-- ============================================================================

ALTER TABLE dataset_relationships DROP CONSTRAINT IF EXISTS dataset_relationships_source_dataset_id_fkey;
ALTER TABLE dataset_relationships DROP CONSTRAINT IF EXISTS dataset_relationships_target_dataset_id_fkey;

ALTER TABLE dataset_relationships ALTER COLUMN source_dataset_id TYPE VARCHAR(255);
ALTER TABLE dataset_relationships ALTER COLUMN target_dataset_id TYPE VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_dataset_relationships_source_vchar ON dataset_relationships(source_dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_target_vchar ON dataset_relationships(target_dataset_id);
