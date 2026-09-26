-- Phase 16: Advanced AI & Automated Insights Schema Migration
-- Defines tables for persistent AI insights, executive summaries, and user feedback tracking.

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE SET NULL,
  metric_id UUID REFERENCES metrics(id) ON DELETE SET NULL,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'trend', 'growth', 'decline', 'anomaly', 'forecast',
    'kpi', 'data_quality', 'relationship', 'comparison',
    'ranking', 'operational', 'executive_summary'
  )),
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'positive', 'warning', 'critical')),
  confidence NUMERIC(5, 2) DEFAULT 0.95,
  evidence JSONB DEFAULT '{}'::jsonb,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  recommendation JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'archived')),
  feedback VARCHAR(50) CHECK (feedback IN ('useful', 'not_useful', null)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_org_status ON ai_insights(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_dataset_id ON ai_insights(dataset_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_metric_id ON ai_insights(metric_id);

-- Enable Row Level Security (RLS)
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- Tenant isolation RLS policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_insights' AND policyname = 'tenant_isolation_ai_insights'
  ) THEN
    CREATE POLICY tenant_isolation_ai_insights ON ai_insights
      USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
  END IF;
END $$;
