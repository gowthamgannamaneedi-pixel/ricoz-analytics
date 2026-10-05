/**
 * In-Memory & TTL-Aware Token Revocation Blacklist
 * Guarantees that logged-out JWT tokens cannot be used to access protected APIs.
 */
class TokenBlacklist {
  constructor() {
    this.revokedTokens = new Map(); // token -> expiresAt (timestamp)
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
   * Remove expired tokens from memory
   */
  cleanup() {
    const now = Date.now();
    for (const [token, expiresAt] of this.revokedTokens.entries()) {
      if (now > expiresAt) {
        this.revokedTokens.delete(token);
      }
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.revokedTokens.clear();
  }
}

const tokenBlacklist = new TokenBlacklist();
module.exports = tokenBlacklist;
