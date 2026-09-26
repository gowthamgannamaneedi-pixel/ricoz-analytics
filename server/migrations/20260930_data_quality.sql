-- Phase 15: Data Quality & Observability Migration
-- Creates dataset_quality_snapshots and dataset_quality_rules tables with multi-tenant RLS

CREATE TABLE IF NOT EXISTS dataset_quality_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quality_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (quality_score >= 0 AND quality_score <= 100),
  status VARCHAR(50) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  completeness NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (completeness >= 0 AND completeness <= 100),
  validity NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (validity >= 0 AND validity <= 100),
  uniqueness NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (uniqueness >= 0 AND uniqueness <= 100),
  consistency NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (consistency >= 0 AND consistency <= 100),
  freshness NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (freshness >= 0 AND freshness <= 100),
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  scan_mode VARCHAR(20) NOT NULL DEFAULT 'FULL_SCAN' CHECK (scan_mode IN ('FULL_SCAN', 'SAMPLED')),
  sample_size INTEGER DEFAULT NULL,
  schema_hash VARCHAR(64) DEFAULT NULL,
  dimensions JSONB DEFAULT '{}'::jsonb,
  column_metrics JSONB DEFAULT '[]'::jsonb,
  issues JSONB DEFAULT '[]'::jsonb,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_snapshots_dataset_id ON dataset_quality_snapshots(dataset_id);
CREATE INDEX IF NOT EXISTS idx_quality_snapshots_org_id ON dataset_quality_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_snapshots_evaluated_at ON dataset_quality_snapshots(evaluated_at DESC);

-- Enable RLS for quality snapshots
ALTER TABLE dataset_quality_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY quality_snapshots_org_isolation ON dataset_quality_snapshots
  FOR ALL
  USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);

-- Dataset Quality Rules Table
CREATE TABLE IF NOT EXISTS dataset_quality_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  column_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('not_null', 'unique', 'min_value', 'max_value', 'valid_email', 'valid_date', 'regex_match', 'allowed_values', 'foreign_key_exists')),
  configuration JSONB DEFAULT '{}'::jsonb,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_rules_dataset_id ON dataset_quality_rules(dataset_id);
CREATE INDEX IF NOT EXISTS idx_quality_rules_org_id ON dataset_quality_rules(organization_id);

-- Enable RLS for quality rules
ALTER TABLE dataset_quality_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY quality_rules_org_isolation ON dataset_quality_rules
  FOR ALL
  USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);
