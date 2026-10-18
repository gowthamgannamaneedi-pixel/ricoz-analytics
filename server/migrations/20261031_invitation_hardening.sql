-- Migration: 20261031_invitation_hardening.sql
-- Enforce strict seat counting, hashed invitation tokens, and prevent duplicate pending invitations

-- 0. Ensure invitations table exists
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  token VARCHAR(255) UNIQUE NOT NULL,
  token_hash VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 1. Add token_hash column for cryptographically hashed tokens
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255);

-- 2. Populate token_hash for existing tokens if null (using SHA-256)
UPDATE invitations
SET token_hash = encode(sha256(token::bytea), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- 3. Create index on token_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);

-- 4. Create partial unique index to strictly prevent duplicate pending invitations per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_org_pending_email
ON invitations(organization_id, LOWER(email))
WHERE status = 'pending';

-- 5. Create index on invitations status, expires_at, and organization_id for fast seat calculation
CREATE INDEX IF NOT EXISTS idx_invitations_seat_calc
ON invitations(organization_id, status, expires_at);
