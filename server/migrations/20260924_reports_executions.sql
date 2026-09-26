-- ==============================================================================
-- RicozAnalytics Phase 9: Report Executions Migration
-- Engine: Supabase PostgreSQL 15+
-- File: server/migrations/20260924_reports_executions.sql
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
