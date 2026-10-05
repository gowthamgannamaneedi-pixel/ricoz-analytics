-- ==============================================================================
-- RicozAnalytics SaaS Subscription, 14-Day Free Trial & Tenant Isolation Migration
-- Migration: 20261020_saas_trial_payment.sql
-- ==============================================================================

-- 1. Organizations: Trial & Subscription Lifecycle Fields
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- 2. Users: Email Verification & Cryptographic Token Fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verification_otp VARCHAR(10),
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- 3. Team Member Invitations
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'manager', 'analyst', 'viewer')),
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- 4. Subscription Invoices & Payment Audit
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'paid',
    invoice_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);

-- 5. Safe Migration for Existing Seed Data (Organization 1 -> Active Enterprise)
UPDATE public.organizations
SET 
  trial_started_at = COALESCE(trial_started_at, '2026-01-01 00:00:00+00'),
  trial_ends_at = COALESCE(trial_ends_at, '2026-12-31 23:59:59+00'),
  subscription_status = 'active',
  payment_status = 'paid',
  plan = 'enterprise'
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.users
SET 
  status = 'active',
  email_verified_at = COALESCE(email_verified_at, '2026-01-01 00:00:00+00')
WHERE organization_id = '00000000-0000-0000-0000-000000000001';
