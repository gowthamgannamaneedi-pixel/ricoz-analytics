-- ==============================================================================
-- RicozAnalytics Razorpay Payment Gateway, Orders & Webhook Idempotency Migration
-- Migration: 20261101_razorpay_payment_gateway.sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations: Razorpay Association Fields
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);

-- 2. Invoices: Multi-gateway and Razorpay Tracking Fields
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_invoice_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_payment ON public.invoices(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_order ON public.invoices(razorpay_order_id);

-- 3. Razorpay Orders Table: Authoritative Server-Generated Checkout Orders
CREATE TABLE IF NOT EXISTS public.razorpay_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255) NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    plan_id VARCHAR(50) NOT NULL,
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'cancelled')),
    payment_id VARCHAR(255),
    signature VARCHAR(255),
    receipt VARCHAR(100),
    notes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint on order_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_razorpay_orders_order_id'
    ) THEN
        ALTER TABLE public.razorpay_orders
            ADD CONSTRAINT uq_razorpay_orders_order_id UNIQUE (order_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_order_id ON public.razorpay_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_org_id ON public.razorpay_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_payment_id ON public.razorpay_orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status ON public.razorpay_orders(status);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_created_at ON public.razorpay_orders(created_at DESC);

-- 4. Razorpay Webhook Events: Persistent Idempotency Ledger
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    payment_id VARCHAR(255),
    order_id VARCHAR(255),
    error_message TEXT,
    payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint on event_id for atomic duplicate rejection
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_razorpay_webhook_events_event_id'
    ) THEN
        ALTER TABLE public.razorpay_webhook_events
            ADD CONSTRAINT uq_razorpay_webhook_events_event_id UNIQUE (event_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_event_id ON public.razorpay_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_event_type ON public.razorpay_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_org_id ON public.razorpay_webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_status ON public.razorpay_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_order_id ON public.razorpay_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_payment_id ON public.razorpay_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_created_at ON public.razorpay_webhook_events(created_at DESC);
