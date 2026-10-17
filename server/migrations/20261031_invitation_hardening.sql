-- Migration: 20261031_invitation_hardening.sql
-- Enforce strict seat counting, hashed invitation tokens, and prevent duplicate pending invitations

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
