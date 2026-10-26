-- ==============================================================================
-- RicozAnalytics Trial Expiry & Subscription Reconciliation Migration
-- Migration: 20261102_trial_dates_reconciliation.sql
-- ==============================================================================

-- 1. Ensure columns exist with reliable defaults
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- 2. Safe, Idempotent Backfill for existing organizations with missing trial dates
-- IMPORTANT: Derives trial_started_at from created_at so old accounts are NOT granted a fresh trial.
UPDATE public.organizations
SET
  trial_started_at = COALESCE(trial_started_at, created_at, CURRENT_TIMESTAMP),
  trial_ends_at = COALESCE(
    trial_ends_at,
    (COALESCE(trial_started_at, created_at, CURRENT_TIMESTAMP) + INTERVAL '14 days')
  )
WHERE trial_started_at IS NULL OR trial_ends_at IS NULL;

-- 3. Reconcile trial status based on authoritative timestamps:
-- If an organization is on trial and its trial_ends_at has elapsed, mark it trial_expired.
UPDATE public.organizations
SET subscription_status = 'trial_expired'
WHERE (subscription_status = 'trial' OR subscription_status IS NULL)
  AND trial_ends_at < CURRENT_TIMESTAMP;

-- 4. For active paid accounts with missing current_period_end, ensure a valid period end timestamp
UPDATE public.organizations
SET current_period_end = COALESCE(current_period_end, next_billing_date, trial_ends_at, created_at + INTERVAL '1 month')
WHERE subscription_status = 'active' AND current_period_end IS NULL;
