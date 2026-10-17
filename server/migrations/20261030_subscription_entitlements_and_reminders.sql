-- ==============================================================================
-- RicozAnalytics Production Subscription, Plan Enforcement & Expiry Reminders Migration
-- Migration: 20261030_subscription_entitlements_and_reminders.sql
-- ==============================================================================

-- 1. Organizations: Enhanced Subscription, Billing Interval & Downgrade Tracking
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_effective_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_downgrade_plan VARCHAR(50),
  ADD COLUMN IF NOT EXISTS scheduled_downgrade_effective_date TIMESTAMPTZ;

-- 2. Subscription Audit History Table
CREATE TABLE IF NOT EXISTS public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- created, upgrade, downgrade_scheduled, downgrade_applied, renewed, cancelled, payment_failed, expired
    from_plan VARCHAR(50),
    to_plan VARCHAR(50),
    billing_interval VARCHAR(20),
    amount NUMERIC(10, 2),
    currency VARCHAR(10) DEFAULT 'inr',
    status VARCHAR(50) NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON public.subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON public.subscription_history(created_at DESC);

-- 3. Subscription Expiry & Renewal Reminders Table (with unique milestone constraint)
CREATE TABLE IF NOT EXISTS public.subscription_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL, -- '10_day_warning', 'trial_10_day_warning', 'expired_notice'
    target_date DATE NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
    attempt_count INT NOT NULL DEFAULT 1,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_sub_reminder UNIQUE (organization_id, reminder_type, target_date)
);

CREATE INDEX IF NOT EXISTS idx_sub_reminders_org ON public.subscription_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_reminders_target_date ON public.subscription_reminders(target_date);

-- 4. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

-- Ensure get_auth_org_id exists safely if auth schema is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_auth_org_id') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'subscription_history' AND policyname = 'subscription_history_org_isolation'
        ) THEN
            CREATE POLICY subscription_history_org_isolation ON public.subscription_history
                USING (organization_id = public.get_auth_org_id() OR organization_id IS NULL)
                WITH CHECK (organization_id = public.get_auth_org_id());
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'subscription_reminders' AND policyname = 'subscription_reminders_org_isolation'
        ) THEN
            CREATE POLICY subscription_reminders_org_isolation ON public.subscription_reminders
                USING (organization_id = public.get_auth_org_id() OR organization_id IS NULL)
                WITH CHECK (organization_id = public.get_auth_org_id());
        END IF;
    END IF;
END $$;
