-- Migration: 20261016_demo_email_jobs.sql
-- Description: Durable retryable background queue for enterprise demo request email notifications

CREATE TABLE IF NOT EXISTS demo_email_jobs (
  id SERIAL PRIMARY KEY,
  demo_request_id VARCHAR(100),
  recipient VARCHAR(255) NOT NULL,
  prospect_email VARCHAR(255),
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  internal_message_id VARCHAR(255),
  prospect_message_id VARCHAR(255),
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_status_next ON demo_email_jobs(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_request ON demo_email_jobs(demo_request_id);

-- Performance indexes for demo_requests table
CREATE INDEX IF NOT EXISTS idx_demo_requests_work_email ON demo_requests(work_email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at_desc ON demo_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);

-- Optional columns for tracking email status on demo_requests
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS email_status VARCHAR(50) DEFAULT 'queued';
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS email_delivery_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_demo_requests_idempotency ON demo_requests(idempotency_key);
