-- ==============================================================================
-- RicozAnalytics Phase 11: Predictive Forecasting & ML Anomaly Detection Migration
-- Engine: Supabase PostgreSQL 15+
-- File: server/migrations/20260926_forecasting.sql
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
