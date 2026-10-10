-- ============================================================================
-- RICOZANALYTICS ENTERPRISE PLATFORM — DATASET ROWS MIGRATION
-- Enables relational PostgreSQL storage and indexed analytics queries for large datasets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dataset_rows (
  id BIGSERIAL PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON public.dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_org ON public.dataset_rows(dataset_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_row_idx ON public.dataset_rows(dataset_id, row_index);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_data_gin ON public.dataset_rows USING gin (data);
