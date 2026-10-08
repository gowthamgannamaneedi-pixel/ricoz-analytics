-- Phase 15 Enterprise Extension: Asynchronous Data Quality Jobs Table
-- Enables resilient, asynchronous, chunked data quality evaluations for large enterprise datasets

CREATE TABLE IF NOT EXISTS data_quality_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL DEFAULT 'FULL_SCAN' CHECK (job_type IN ('FULL_SCAN', 'SAMPLED', 'QUALITY_AUDIT')),
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  rows_processed INTEGER NOT NULL DEFAULT 0,
  total_rows INTEGER NOT NULL DEFAULT 0,
  stage VARCHAR(100) NOT NULL DEFAULT 'INITIALIZING',
  scan_mode VARCHAR(20) NOT NULL DEFAULT 'FULL_SCAN' CHECK (scan_mode IN ('FULL_SCAN', 'SAMPLED')),
  sample_size INTEGER DEFAULT NULL,
  snapshot_id UUID REFERENCES dataset_quality_snapshots(id) ON DELETE SET NULL,
  error_message TEXT DEFAULT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_jobs_dataset_id ON data_quality_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_quality_jobs_org_id ON data_quality_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_jobs_status ON data_quality_jobs(status);
CREATE INDEX IF NOT EXISTS idx_quality_jobs_created_at ON data_quality_jobs(created_at DESC);

ALTER TABLE data_quality_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY quality_jobs_org_isolation ON data_quality_jobs
  FOR ALL
  USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);
