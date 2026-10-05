-- ==============================================================================
-- RicozAnalytics Persistent Stripe Webhook Idempotency Migration
-- Migration: 20261026_stripe_webhook_events.sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    error_message TEXT,
    payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint on stripe_event_id for transaction-safe deduplication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_stripe_webhook_events_event_id'
    ) THEN
        ALTER TABLE public.stripe_webhook_events
            ADD CONSTRAINT uq_stripe_webhook_events_event_id UNIQUE (stripe_event_id);
    END IF;
END $$;

-- Indexes for performance and multi-tenant audit lookups
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON public.stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_org_id ON public.stripe_webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON public.stripe_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at ON public.stripe_webhook_events(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizations can only inspect their own webhook events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stripe_webhook_events' AND policyname = 'stripe_webhook_events_org_isolation'
    ) THEN
        CREATE POLICY stripe_webhook_events_org_isolation ON public.stripe_webhook_events
            USING (organization_id = public.get_auth_org_id() OR organization_id IS NULL)
            WITH CHECK (organization_id = public.get_auth_org_id());
    END IF;
END $$;
