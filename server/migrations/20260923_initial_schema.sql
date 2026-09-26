-- ==============================================================================
-- RicozAnalytics Production Database Schema Migration
-- Target Engine: Supabase PostgreSQL 15+
-- Version: 1.0.0
-- Created: 2026-09-23
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE HELPER FUNCTIONS (Table-Independent)
-- ==============================================================================

-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. CORE TABLES DEFINITION (10 Core Entities)
-- ==============================================================================

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (Application user profile synced with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'manager', 'viewer')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. DATA SOURCES
CREATE TABLE IF NOT EXISTS public.data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('csv', 'json', 'postgresql', 'mysql', 'mongodb', 'rest_api')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'connected', 'error', 'pending', 'syncing')),
    config JSONB DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. DATASETS
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500),
    row_count INTEGER DEFAULT 0 CHECK (row_count >= 0),
    column_count INTEGER DEFAULT 0 CHECK (column_count >= 0),
    schema JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. METRICS (Reusable KPIs and calculations)
CREATE TABLE IF NOT EXISTS public.metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    formula TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'currency' CHECK (type IN ('currency', 'percentage', 'count', 'decimal', 'custom')),
    unit VARCHAR(50),
    target_value NUMERIC,
    formatting JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. DASHBOARDS
CREATE TABLE IF NOT EXISTS public.dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    layout JSONB DEFAULT '[]'::jsonb,
    filters JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. DASHBOARD WIDGETS
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL,
    metric_id UUID REFERENCES public.metrics(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('kpi_card', 'line_chart', 'bar_chart', 'pie_chart', 'area_chart', 'table', 'scatter_plot', 'metric_gauge')),
    configuration JSONB DEFAULT '{}'::jsonb,
    position JSONB DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    format VARCHAR(50) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'json', 'excel', 'email_summary')),
    schedule_cron VARCHAR(100),
    recipients JSONB DEFAULT '[]'::jsonb,
    last_generated_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. ALERTS
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    metric_id UUID REFERENCES public.metrics(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('greater_than', 'less_than', 'equals', 'not_equals', 'percentage_change_increase', 'percentage_change_decrease')),
    threshold NUMERIC NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'resolved', 'disabled')),
    notification_channels JSONB DEFAULT '["in_app"]'::jsonb,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. FORECASTS
CREATE TABLE IF NOT EXISTS public.forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_column VARCHAR(255) NOT NULL,
    date_column VARCHAR(255) NOT NULL,
    horizon_periods INTEGER NOT NULL DEFAULT 30 CHECK (horizon_periods > 0),
    interval VARCHAR(50) NOT NULL DEFAULT 'daily' CHECK (interval IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly')),
    model_name VARCHAR(100) NOT NULL DEFAULT 'arima' CHECK (model_name IN ('arima', 'prophet', 'linear_regression', 'exponential_smoothing', 'gemini_ml')),
    predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_intervals JSONB DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. AUTH & SECURITY HELPER FUNCTIONS (Dependent on Core Tables)
-- ==============================================================================

-- Helper function to resolve the current authenticated user's organization ID
CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper function to check if the current user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND (role = required_role OR role = 'admin')
  );
$$;

-- ==============================================================================
-- 5. PERFORMANCE & FOREIGN KEY INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_data_sources_organization_id ON public.data_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_user_id ON public.data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON public.data_sources(type);
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON public.data_sources(status);

CREATE INDEX IF NOT EXISTS idx_datasets_organization_id ON public.datasets(organization_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON public.datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_data_source_id ON public.datasets(data_source_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON public.datasets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_organization_id ON public.metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_metrics_dataset_id ON public.metrics(dataset_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created_by ON public.metrics(created_by);

CREATE INDEX IF NOT EXISTS idx_dashboards_organization_id ON public.dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON public.dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_default ON public.dashboards(is_default);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard_id ON public.dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dataset_id ON public.dashboard_widgets(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_metric_id ON public.dashboard_widgets(metric_id);

CREATE INDEX IF NOT EXISTS idx_reports_organization_id ON public.reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_dashboard_id ON public.reports(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON public.alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dataset_id ON public.alerts(dataset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_metric_id ON public.alerts(metric_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);

CREATE INDEX IF NOT EXISTS idx_forecasts_organization_id ON public.forecasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_dataset_id ON public.forecasts(dataset_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_created_by ON public.forecasts(created_by);
CREATE INDEX IF NOT EXISTS idx_forecasts_status ON public.forecasts(status);

-- ==============================================================================
-- 6. AUTOMATIC TIMESTAMP TRIGGERS
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_data_sources_updated_at ON public.data_sources;
CREATE TRIGGER trg_data_sources_updated_at BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_datasets_updated_at ON public.datasets;
CREATE TRIGGER trg_datasets_updated_at BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_metrics_updated_at ON public.metrics;
CREATE TRIGGER trg_metrics_updated_at BEFORE UPDATE ON public.metrics FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_dashboards_updated_at ON public.dashboards;
CREATE TRIGGER trg_dashboards_updated_at BEFORE UPDATE ON public.dashboards FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_dashboard_widgets_updated_at ON public.dashboard_widgets;
CREATE TRIGGER trg_dashboard_widgets_updated_at BEFORE UPDATE ON public.dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_alerts_updated_at ON public.alerts;
CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_forecasts_updated_at ON public.forecasts;
CREATE TRIGGER trg_forecasts_updated_at BEFORE UPDATE ON public.forecasts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. SUPABASE AUTH USER SYNCHRONIZATION TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all 10 core tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. ORGANIZATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Admins can update their own organization" ON public.organizations;
CREATE POLICY "Admins can update their own organization"
  ON public.organizations FOR UPDATE
  USING (id = public.get_auth_org_id() AND public.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 2. USERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view members in same organization" ON public.users;
CREATE POLICY "Users can view members in same organization"
  ON public.users FOR SELECT
  USING (organization_id = public.get_auth_org_id() OR id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3. DATA SOURCES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view data sources" ON public.data_sources;
CREATE POLICY "Org members can view data sources"
  ON public.data_sources FOR SELECT
  USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Org members can create data sources" ON public.data_sources;
CREATE POLICY "Org members can create data sources"
  ON public.data_sources FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Owners or Admins can update data sources" ON public.data_sources;
CREATE POLICY "Owners or Admins can update data sources"
  ON public.data_sources FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (user_id = auth.uid() OR public.has_role('admin')));

DROP POLICY IF EXISTS "Owners or Admins can delete data sources" ON public.data_sources;
CREATE POLICY "Owners or Admins can delete data sources"
  ON public.data_sources FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (user_id = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 4. DATASETS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view datasets" ON public.datasets;
CREATE POLICY "Org members can view datasets"
  ON public.datasets FOR SELECT
  USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Org members can create datasets" ON public.datasets;
CREATE POLICY "Org members can create datasets"
  ON public.datasets FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Owners or Admins can update datasets" ON public.datasets;
CREATE POLICY "Owners or Admins can update datasets"
  ON public.datasets FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (user_id = auth.uid() OR public.has_role('admin')));

DROP POLICY IF EXISTS "Owners or Admins can delete datasets" ON public.datasets;
CREATE POLICY "Owners or Admins can delete datasets"
  ON public.datasets FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (user_id = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 5. METRICS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view metrics" ON public.metrics;
CREATE POLICY "Org members can view metrics"
  ON public.metrics FOR SELECT
  USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Analysts, Managers, Admins can create metrics" ON public.metrics;
CREATE POLICY "Analysts, Managers, Admins can create metrics"
  ON public.metrics FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creators or Admins can update metrics" ON public.metrics;
CREATE POLICY "Creators or Admins can update metrics"
  ON public.metrics FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

DROP POLICY IF EXISTS "Creators or Admins can delete metrics" ON public.metrics;
CREATE POLICY "Creators or Admins can delete metrics"
  ON public.metrics FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 6. DASHBOARDS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view dashboards" ON public.dashboards;
CREATE POLICY "Org members can view dashboards"
  ON public.dashboards FOR SELECT
  USING (organization_id = public.get_auth_org_id() OR is_public = true);

DROP POLICY IF EXISTS "Org members can create dashboards" ON public.dashboards;
CREATE POLICY "Org members can create dashboards"
  ON public.dashboards FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creators or Admins can update dashboards" ON public.dashboards;
CREATE POLICY "Creators or Admins can update dashboards"
  ON public.dashboards FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

DROP POLICY IF EXISTS "Creators or Admins can delete dashboards" ON public.dashboards;
CREATE POLICY "Creators or Admins can delete dashboards"
  ON public.dashboards FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 7. DASHBOARD WIDGETS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view dashboard widgets" ON public.dashboard_widgets;
CREATE POLICY "Org members can view dashboard widgets"
  ON public.dashboard_widgets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.dashboards d
    WHERE d.id = dashboard_widgets.dashboard_id
      AND (d.organization_id = public.get_auth_org_id() OR d.is_public = true)
  ));

DROP POLICY IF EXISTS "Dashboard editors can insert widgets" ON public.dashboard_widgets;
CREATE POLICY "Dashboard editors can insert widgets"
  ON public.dashboard_widgets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dashboards d
    WHERE d.id = dashboard_widgets.dashboard_id
      AND d.organization_id = public.get_auth_org_id()
      AND (d.created_by = auth.uid() OR public.has_role('admin'))
  ));

DROP POLICY IF EXISTS "Dashboard editors can update widgets" ON public.dashboard_widgets;
CREATE POLICY "Dashboard editors can update widgets"
  ON public.dashboard_widgets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.dashboards d
    WHERE d.id = dashboard_widgets.dashboard_id
      AND d.organization_id = public.get_auth_org_id()
      AND (d.created_by = auth.uid() OR public.has_role('admin'))
  ));

DROP POLICY IF EXISTS "Dashboard editors can delete widgets" ON public.dashboard_widgets;
CREATE POLICY "Dashboard editors can delete widgets"
  ON public.dashboard_widgets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.dashboards d
    WHERE d.id = dashboard_widgets.dashboard_id
      AND d.organization_id = public.get_auth_org_id()
      AND (d.created_by = auth.uid() OR public.has_role('admin'))
  ));

-- ------------------------------------------------------------------------------
-- 8. REPORTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view reports" ON public.reports;
CREATE POLICY "Org members can view reports"
  ON public.reports FOR SELECT
  USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Org members can create reports" ON public.reports;
CREATE POLICY "Org members can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creators or Admins can update reports" ON public.reports;
CREATE POLICY "Creators or Admins can update reports"
  ON public.reports FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

DROP POLICY IF EXISTS "Creators or Admins can delete reports" ON public.reports;
CREATE POLICY "Creators or Admins can delete reports"
  ON public.reports FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 9. ALERTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view alerts" ON public.alerts;
CREATE POLICY "Org members can view alerts"
  ON public.alerts FOR SELECT
  USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Org members can create alerts" ON public.alerts;
CREATE POLICY "Org members can create alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creators or Admins can update alerts" ON public.alerts;
CREATE POLICY "Creators or Admins can update alerts"
  ON public.alerts FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

DROP POLICY IF EXISTS "Creators or Admins can delete alerts" ON public.alerts;
CREATE POLICY "Creators or Admins can delete alerts"
  ON public.alerts FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 10. FORECASTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view forecasts" ON public.forecasts;
CREATE POLICY "Org members can view forecasts"
  ON public.forecasts FOR SELECT
  USING (organization_id = public.get_auth_org_id());

DROP POLICY IF EXISTS "Analysts, Managers, Admins can create forecasts" ON public.forecasts;
CREATE POLICY "Analysts, Managers, Admins can create forecasts"
  ON public.forecasts FOR INSERT
  WITH CHECK (organization_id = public.get_auth_org_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creators or Admins can update forecasts" ON public.forecasts;
CREATE POLICY "Creators or Admins can update forecasts"
  ON public.forecasts FOR UPDATE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));

-- ------------------------------------------------------------------------------
-- 10. FORECASTS POLICIES (Delete)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Creators or Admins can delete forecasts" ON public.forecasts;
CREATE POLICY "Creators or Admins can delete forecasts"
  ON public.forecasts FOR DELETE
  USING (organization_id = public.get_auth_org_id() AND (created_by = auth.uid() OR public.has_role('admin')));
