const db = require('../config/database');

/**
 * User Data Access Model for PostgreSQL
 */
const UserModel = {
  /**
   * Find user by email (case-insensitive)
   * @param {string} email 
   * @returns {Promise<any | null>}
   */
  async findByEmail(email) {
    const sql = `
      SELECT id, name, email, password_hash, role, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await db.query(sql, [email.trim()]);
    return result.rows[0] || null;
  },

  /**
   * Find user by primary key ID
   * @param {number|string} id 
   * @returns {Promise<any | null>}
   */
  async findById(id) {
    const sql = `
      SELECT id, name, email, role, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  },

  /**
   * Create a new user record
   * @param {{ name: string, email: string, password_hash: string, role?: string }} data
   * @returns {Promise<{ id: number, name: string, email: string, role: string, created_at: Date }>}
   */
  async create({ name, email, password_hash, role = 'viewer' }) {
    const sql = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at, updated_at;
    `;
    const result = await db.query(sql, [
      name.trim(),
      email.trim().toLowerCase(),
      password_hash,
      role
    ]);
    return result.rows[0];
  }
};

module.exports = UserModel;
