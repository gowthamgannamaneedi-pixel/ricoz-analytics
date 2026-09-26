-- ============================================================================
-- Phase 14: Relational Data Modeling & Dataset Joins Migration
-- ============================================================================

-- 1. Create dataset_relationships table
CREATE TABLE IF NOT EXISTS dataset_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    source_dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    source_column VARCHAR(255) NOT NULL,
    target_dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    target_column VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'many_to_one' 
        CHECK (relationship_type IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate relationship on same source and target columns
    CONSTRAINT unique_dataset_relationship_cols UNIQUE(organization_id, source_dataset_id, source_column, target_dataset_id, target_column)
);

-- 2. Indexes for High-Performance Join Resolutions
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_org ON dataset_relationships(organization_id);
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_source ON dataset_relationships(source_dataset_id, source_column);
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_target ON dataset_relationships(target_dataset_id, target_column);

-- 3. Row-Level Security (RLS)
ALTER TABLE dataset_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY dataset_relationships_org_isolation ON dataset_relationships
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        OR organization_id IS NULL
    );
