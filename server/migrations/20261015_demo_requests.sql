-- Migration: 20261015_demo_requests.sql
-- Description: Create demo_requests table for storing enterprise walkthrough inquiries

CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  work_email VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  team_size VARCHAR(100) NOT NULL,
  primary_data_source VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_email ON demo_requests(work_email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON demo_requests(created_at);
