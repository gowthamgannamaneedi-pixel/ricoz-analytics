-- ==============================================================================
-- RicozAnalytics Password Reset & Account Recovery Migration
-- Migration: 20261025_password_reset.sql
-- ==============================================================================

-- 1. Add reset password token and expiry fields to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON public.users(reset_password_token);

-- 2. Row Level Security on invitations and invoices
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invitations' AND policyname = 'invitations_org_isolation'
  ) THEN
    CREATE POLICY invitations_org_isolation ON public.invitations
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invoices' AND policyname = 'invoices_org_isolation'
  ) THEN
    CREATE POLICY invoices_org_isolation ON public.invoices
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;
END $$;
