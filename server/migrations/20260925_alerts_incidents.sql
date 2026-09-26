-- ==============================================================================
-- RicozAnalytics Phase 10: Real-Time Alerts Engine & Incident Center Migration
-- Engine: Supabase PostgreSQL 15+
-- File: server/migrations/20260925_alerts_incidents.sql
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
