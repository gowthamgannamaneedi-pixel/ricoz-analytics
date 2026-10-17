-- Migration: 20261017_demo_email_queue_v2.sql
-- Description: Advanced queue worker enhancements for independent recipient tracking, atomic locking, and idempotency

-- 1. Ensure demo_requests has all tracking and metadata columns
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS work_email VARCHAR(255);
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS primary_data_source VARCHAR(100);
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS email_status VARCHAR(50) DEFAULT 'queued';
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS email_delivery_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_demo_requests_work_email ON demo_requests(work_email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at_desc ON demo_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_idempotency ON demo_requests(idempotency_key);

-- 2. Enhance demo_email_jobs with separate delivery tracking and atomic lock fields
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS internal_status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS prospect_status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS internal_error TEXT;
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS prospect_error TEXT;
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(50);
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS locked_by VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_status_next ON demo_email_jobs(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_request ON demo_email_jobs(demo_request_id);
CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_delivery_status ON demo_email_jobs(internal_status, prospect_status);
