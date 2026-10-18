-- Migration: 20261018_last_active_presence.sql
-- Add last_active_at timestamp for real-time presence tracking and inactivity thresholding
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users (last_active_at);
