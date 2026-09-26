-- ==============================================================================
-- RICOZ ANALYTICS - CONSOLIDATED PRODUCTION SCHEMA SYNCHRONIZATION
-- Target Engine: Supabase PostgreSQL 15+
-- Migration File: server/migrations/PRODUCTION_SCHEMA_SYNC.sql
-- 
-- Consolidates all post-initial migrations in exact repository order:
--   1. Phase 9:  20260924_reports_executions.sql
--   2. Phase 10: 20260925_alerts_incidents.sql
--   3. Phase 11: 20260926_forecasting.sql
--   4. Phase 12: 20260927_ai_conversations.sql
--   5. Phase 13: 20260928_governance_audit.sql
--   6. Phase 14: 20260929_dataset_relationships.sql
--   7. Phase 15: 20260930_data_quality.sql
--   8. Phase 16: 20261005_ai_insights.sql
--   9. Phase 17: 20261010_collaboration.sql
-- 
-- Safety Guarantees:
--   - Non-destructive: No tables, columns, or data dropped.
--   - Idempotent: Uses IF NOT EXISTS, conditional ALTERs, and safe constraint checks.
--   - Compatible with existing 20260923_initial_schema.sql.
-- ==============================================================================

BEGIN;

-- Ensure UUID generation extension exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PHASE 9: REPORT EXECUTIONS (20260924_reports_executions.sql)
-- ==============================================================================

-- 1. Create REPORT_EXECUTIONS table
CREATE TABLE IF NOT EXISTS public.report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    executed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    format VARCHAR(50) NOT NULL CHECK (format IN ('pdf', 'csv', 'json', 'excel', 'email_summary')),
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    file_size INTEGER DEFAULT 0,
    file_path VARCHAR(500),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for Performance & Scoped Lookups
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON public.report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_organization_id ON public.report_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_executed_by ON public.report_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON public.report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_created_at ON public.report_executions(created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Multi-Tenant Isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'report_executions' AND policyname = 'report_executions_org_isolation'
  ) THEN
    CREATE POLICY report_executions_org_isolation ON public.report_executions
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;
END $$;

-- ==============================================================================
-- PHASE 10: REAL-TIME ALERTS & INCIDENT CENTER (20260925_alerts_incidents.sql)
-- ==============================================================================

-- 1. Ensure alerts table has cooldown and recipients fields
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 60 CHECK (cooldown_minutes >= 0);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT '[]'::jsonb;

-- 2. Expand condition check constraint on public.alerts to support standard and alias names
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_condition_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_condition_check CHECK (condition IN (
  'greater_than',
  'less_than',
  'equal',
  'equals',
  'not_equal',
  'not_equals',
  'percent_increase',
  'percentage_change_increase',
  'percent_decrease',
  'percentage_change_decrease'
));

-- 3. Create ALERT_INCIDENTS table
CREATE TABLE IF NOT EXISTS public.alert_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric_value NUMERIC NOT NULL,
    threshold_value NUMERIC NOT NULL,
    condition VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved', 'suppressed')),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    notification_delivery JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes for Performance, Fast Querying & Scoped Lookups
CREATE INDEX IF NOT EXISTS idx_alert_incidents_alert_id ON public.alert_incidents(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_organization_id ON public.alert_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_status ON public.alert_incidents(status);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_triggered_at ON public.alert_incidents(triggered_at DESC);

-- 5. Row Level Security (RLS)
ALTER TABLE public.alert_incidents ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for Multi-Tenant Isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'alert_incidents' AND policyname = 'alert_incidents_org_isolation'
  ) THEN
    CREATE POLICY alert_incidents_org_isolation ON public.alert_incidents
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;
END $$;

-- ==============================================================================
-- PHASE 11: PREDICTIVE FORECASTING & ML ANOMALY DETECTION (20260926_forecasting.sql)
-- ==============================================================================

-- 1. Ensure optional metric_id column exists
ALTER TABLE public.forecasts ADD COLUMN IF NOT EXISTS metric_id UUID REFERENCES public.metrics(id) ON DELETE SET NULL;

-- 2. Ensure anomalies JSONB and error_message columns exist
ALTER TABLE public.forecasts ADD COLUMN IF NOT EXISTS anomalies JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.forecasts ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 3. Allow dataset_id to be nullable (enabling metric-driven and direct forecasts)
ALTER TABLE public.forecasts ALTER COLUMN dataset_id DROP NOT NULL;

-- 4. Expand model_name check constraint to support all statistical & ML models
ALTER TABLE public.forecasts DROP CONSTRAINT IF EXISTS forecasts_model_name_check;
ALTER TABLE public.forecasts ADD CONSTRAINT forecasts_model_name_check CHECK (
  model_name IN ('linear_regression', 'exponential_smoothing', 'holt_winters', 'arima', 'prophet', 'gemini_ml', 'auto')
);

-- 5. Expand interval check constraint to support standard frequencies
ALTER TABLE public.forecasts DROP CONSTRAINT IF EXISTS forecasts_interval_check;
ALTER TABLE public.forecasts ADD CONSTRAINT forecasts_interval_check CHECK (
  interval IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')
);

-- 6. Indexes for High-Performance Tenant Lookups
CREATE INDEX IF NOT EXISTS idx_forecasts_organization_id ON public.forecasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_dataset_id ON public.forecasts(dataset_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_metric_id ON public.forecasts(metric_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_status ON public.forecasts(status);
CREATE INDEX IF NOT EXISTS idx_forecasts_created_at ON public.forecasts(created_at DESC);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

-- 8. Multi-Tenant Organization Isolation Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'forecasts' AND policyname = 'forecasts_org_isolation'
  ) THEN
    CREATE POLICY forecasts_org_isolation ON public.forecasts
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;
END $$;

-- ==============================================================================
-- PHASE 12: AI ANALYTICS CONVERSATIONS & MESSAGES (20260927_ai_conversations.sql)
-- ==============================================================================

-- 1. Create AI Conversations Table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'New AI Analytics Conversation',
  dataset_id INTEGER,
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create AI Messages Table
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent VARCHAR(100),
  query_plan JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '[]'::jsonb,
  visualization JSONB DEFAULT '{}'::jsonb,
  sources JSONB DEFAULT '[]'::jsonb,
  confidence VARCHAR(50) DEFAULT 'high',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for High-Performance Tenant & Conversation Lookups
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_id ON public.ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON public.ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON public.ai_messages(created_at ASC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- 5. Multi-Tenant Organization Isolation Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_conversations' AND policyname = 'ai_conversations_org_isolation'
  ) THEN
    CREATE POLICY ai_conversations_org_isolation ON public.ai_conversations
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_messages' AND policyname = 'ai_messages_conversation_isolation'
  ) THEN
    CREATE POLICY ai_messages_conversation_isolation ON public.ai_messages
      USING (
        conversation_id IN (
          SELECT id FROM public.ai_conversations 
          WHERE organization_id = public.get_auth_org_id()
        )
      )
      WITH CHECK (
        conversation_id IN (
          SELECT id FROM public.ai_conversations 
          WHERE organization_id = public.get_auth_org_id()
        )
      );
  END IF;
END $$;

-- ==============================================================================
-- PHASE 13: ENTERPRISE GOVERNANCE & AUDIT LOGS (20260928_governance_audit.sql)
-- ==============================================================================

-- 1. Enhance Users Table with Status & Last Login Tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add check constraint on user status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'deactivated'));
  END IF;
END $$;

-- 2. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(100),
  user_agent VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. High-Performance Indexes for Audit Logs & Organization Lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_org_role ON public.users(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Multi-Tenant Organization Isolation Policy for Audit Logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_org_isolation'
  ) THEN
    CREATE POLICY audit_logs_org_isolation ON public.audit_logs
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;
END $$;

-- ==============================================================================
-- PHASE 14: DATASET RELATIONSHIPS (20260929_dataset_relationships.sql)
-- ==============================================================================

-- 1. Create dataset_relationships table
CREATE TABLE IF NOT EXISTS public.dataset_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by INTEGER,
    source_dataset_id INTEGER NOT NULL,
    source_column VARCHAR(255) NOT NULL,
    target_dataset_id INTEGER NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_org ON public.dataset_relationships(organization_id);
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_source ON public.dataset_relationships(source_dataset_id, source_column);
CREATE INDEX IF NOT EXISTS idx_dataset_relationships_target ON public.dataset_relationships(target_dataset_id, target_column);

-- 3. Row-Level Security (RLS)
ALTER TABLE public.dataset_relationships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dataset_relationships' AND policyname = 'dataset_relationships_org_isolation'
  ) THEN
    CREATE POLICY dataset_relationships_org_isolation ON public.dataset_relationships
        FOR ALL
        USING (
            organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
            OR organization_id IS NULL
        );
  END IF;
END $$;

-- ==============================================================================
-- PHASE 15: DATA QUALITY & OBSERVABILITY (20260930_data_quality.sql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.dataset_quality_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id INTEGER NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_quality_snapshots_dataset_id ON public.dataset_quality_snapshots(dataset_id);
CREATE INDEX IF NOT EXISTS idx_quality_snapshots_org_id ON public.dataset_quality_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_snapshots_evaluated_at ON public.dataset_quality_snapshots(evaluated_at DESC);

-- Enable RLS for quality snapshots
ALTER TABLE public.dataset_quality_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dataset_quality_snapshots' AND policyname = 'quality_snapshots_org_isolation'
  ) THEN
    CREATE POLICY quality_snapshots_org_isolation ON public.dataset_quality_snapshots
      FOR ALL
      USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);
  END IF;
END $$;

-- Dataset Quality Rules Table
CREATE TABLE IF NOT EXISTS public.dataset_quality_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dataset_id INTEGER NOT NULL,
  column_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('not_null', 'unique', 'min_value', 'max_value', 'valid_email', 'valid_date', 'regex_match', 'allowed_values', 'foreign_key_exists')),
  configuration JSONB DEFAULT '{}'::jsonb,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_rules_dataset_id ON public.dataset_quality_rules(dataset_id);
CREATE INDEX IF NOT EXISTS idx_quality_rules_org_id ON public.dataset_quality_rules(organization_id);

-- Enable RLS for quality rules
ALTER TABLE public.dataset_quality_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dataset_quality_rules' AND policyname = 'quality_rules_org_isolation'
  ) THEN
    CREATE POLICY quality_rules_org_isolation ON public.dataset_quality_rules
      FOR ALL
      USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);
  END IF;
END $$;

-- ==============================================================================
-- PHASE 16: AI & AUTOMATED INSIGHTS (20261005_ai_insights.sql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id INTEGER,
  dataset_id INTEGER,
  metric_id UUID REFERENCES public.metrics(id) ON DELETE SET NULL,
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_ai_insights_org_status ON public.ai_insights(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON public.ai_insights(type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON public.ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_dataset_id ON public.ai_insights(dataset_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_metric_id ON public.ai_insights(metric_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Tenant isolation RLS policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_insights' AND policyname = 'tenant_isolation_ai_insights'
  ) THEN
    CREATE POLICY tenant_isolation_ai_insights ON public.ai_insights
      USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
  END IF;
END $$;

-- ==============================================================================
-- PHASE 17: ENTERPRISE COLLABORATION & SHARING (20261010_collaboration.sql)
-- ==============================================================================

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_org ON public.teams(organization_id);

-- 2. Team Members Table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);

-- 3. Dashboard Shares
CREATE TABLE IF NOT EXISTS public.dashboard_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  shared_by BIGINT NOT NULL,
  user_id BIGINT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_dashboard_share_target CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_shares_dash ON public.dashboard_shares(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_user ON public.dashboard_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_team ON public.dashboard_shares(team_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_org ON public.dashboard_shares(organization_id);

-- 4. Report Shares
CREATE TABLE IF NOT EXISTS public.report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  shared_by BIGINT NOT NULL,
  user_id BIGINT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_report_share_target CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_report_shares_rep ON public.report_shares(report_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_user ON public.report_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_team ON public.report_shares(team_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_org ON public.report_shares(organization_id);

-- 5. Insight Shares
CREATE TABLE IF NOT EXISTS public.insight_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_id UUID NOT NULL REFERENCES public.ai_insights(id) ON DELETE CASCADE,
  shared_by BIGINT NOT NULL,
  user_id BIGINT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_insight_share_target CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_insight_shares_ins ON public.insight_shares(insight_id);
CREATE INDEX IF NOT EXISTS idx_insight_shares_user ON public.insight_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_shares_org ON public.insight_shares(organization_id);

-- 6. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_resource ON public.comments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_comments_org ON public.comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON public.comments(created_at DESC);

-- 7. Favorites Table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_favorites_org ON public.favorites(organization_id);

-- 8. Recently Viewed Table
CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON public.recently_viewed(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_org ON public.recently_viewed(organization_id);

-- 9. Saved Views Table
CREATE TABLE IF NOT EXISTS public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_views_dash ON public.saved_views(dashboard_id, user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_org ON public.saved_views(organization_id);

-- 10. In-App Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  actor_id BIGINT,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- Enable RLS on Collaboration tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'tenant_teams_policy'
  ) THEN
    CREATE POLICY tenant_teams_policy ON public.teams
      FOR ALL
      USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dashboard_shares' AND policyname = 'tenant_dashboard_shares_policy'
  ) THEN
    CREATE POLICY tenant_dashboard_shares_policy ON public.dashboard_shares
      FOR ALL
      USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'tenant_comments_policy'
  ) THEN
    CREATE POLICY tenant_comments_policy ON public.comments
      FOR ALL
      USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'tenant_favorites_policy'
  ) THEN
    CREATE POLICY tenant_favorites_policy ON public.favorites
      FOR ALL
      USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'tenant_notifications_policy'
  ) THEN
    CREATE POLICY tenant_notifications_policy ON public.notifications
      FOR ALL
      USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

COMMIT;
