/**
 * In-Memory & TTL-Aware Token Revocation Blacklist
 * Guarantees that logged-out JWT tokens cannot be used to access protected APIs.
 */
class TokenBlacklist {
  constructor() {
    this.revokedTokens = new Map(); // token -> expiresAt (timestamp)
    this.revokedUsers = new Map();  // userId -> expiresAt (timestamp)
    // Run garbage collection every 10 minutes to remove expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Revoke a token until its expiration timestamp
   * @param {string} token 
   * @param {number} [expiresInMs=86400000] Default 24 hours
   */
  revoke(token, expiresInMs = 24 * 60 * 60 * 1000) {
    if (!token || typeof token !== 'string') return;
    const cleanToken = token.trim();
    const expiresAt = Date.now() + expiresInMs;
    this.revokedTokens.set(cleanToken, expiresAt);
  }

  /**
   * Check if a token has been revoked
   * @param {string} token 
   * @returns {boolean}
   */
  isRevoked(token) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    const expiresAt = this.revokedTokens.get(cleanToken);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.revokedTokens.delete(cleanToken);
      return false;
    }
    return true;
  }

  /**
   * Revoke all active sessions for a user ID (e.g., on member removal/deactivation)
   * @param {string|number} userId 
   * @param {number} [expiresInMs=86400000] Default 24 hours
   */
  revokeUser(userId, expiresInMs = 24 * 60 * 60 * 1000) {
    if (!userId) return;
    const cleanId = String(userId).trim().toLowerCase();
    const expiresAt = Date.now() + expiresInMs;
    this.revokedUsers.set(cleanId, expiresAt);
  }

  /**
   * Check if a user's sessions have been revoked
   * @param {string|number} userId 
   * @returns {boolean}
   */
  isUserRevoked(userId) {
    if (!userId) return false;
    const cleanId = String(userId).trim().toLowerCase();
    const expiresAt = this.revokedUsers.get(cleanId);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.revokedUsers.delete(cleanId);
      return false;
    }
    return true;
  }

  /**
   * Remove expired tokens and user revocations from memory
   */
  cleanup() {
    const now = Date.now();
    for (const [token, expiresAt] of this.revokedTokens.entries()) {
      if (now > expiresAt) {
        this.revokedTokens.delete(token);
      }
    }
    for (const [userId, expiresAt] of this.revokedUsers.entries()) {
      if (now > expiresAt) {
        this.revokedUsers.delete(userId);
      }
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.revokedTokens.clear();
    this.revokedUsers.clear();
  }
}

const tokenBlacklist = new TokenBlacklist();
module.exports = tokenBlacklist;
