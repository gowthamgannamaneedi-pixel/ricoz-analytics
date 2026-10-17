const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function cleanup() {
  try {
    console.log('Starting account cleanup with unlimited statement timeout...');
    await db.query('SET statement_timeout = 0');

    const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
    const defaultOrgId = '00000000-0000-0000-0000-000000000001';

    // 1. Ensure admin@ricoz.test exists and is active
    const check1 = await db.query("SELECT id FROM users WHERE LOWER(email) = 'admin@ricoz.test' LIMIT 1");
    if (check1.rows.length === 0) {
      await db.query(`
        INSERT INTO users (id, name, email, password_hash, role, organization_id, status)
        VALUES ('1', 'Gowtham (Admin)', 'admin@ricoz.test', $1, 'admin', $2, 'active')
        ON CONFLICT (id) DO UPDATE SET email = 'admin@ricoz.test', status = 'active'
      `, [defaultPasswordHash, defaultOrgId]);
      console.log('Created admin@ricoz.test');
    } else {
      await db.query("UPDATE users SET status = 'active', password_hash = $1 WHERE LOWER(email) = 'admin@ricoz.test'", [defaultPasswordHash]);
      console.log('Updated admin@ricoz.test to active with admin123 password');
    }

    // 2. Ensure ricoz@admin.test exists and is active
    const check2 = await db.query("SELECT id FROM users WHERE LOWER(email) = 'ricoz@admin.test' LIMIT 1");
    if (check2.rows.length === 0) {
      const maxIdRes = await db.query("SELECT COALESCE(MAX(CASE WHEN id ~ '^[0-9]+$' THEN id::int ELSE 0 END), 0) + 1 AS next_id FROM users");
      const nextId = String(maxIdRes.rows[0]?.next_id || 2);
      await db.query(`
        INSERT INTO users (id, name, email, password_hash, role, organization_id, status)
        VALUES ($1, 'Ricoz Administrator', 'ricoz@admin.test', $2, 'admin', $3, 'active')
      `, [nextId, defaultPasswordHash, defaultOrgId]);
      console.log('Created ricoz@admin.test with id', nextId);
    } else {
      await db.query("UPDATE users SET status = 'active', password_hash = $1 WHERE LOWER(email) = 'ricoz@admin.test'", [defaultPasswordHash]);
      console.log('Updated ricoz@admin.test to active');
    }

    // 3. Find non-admin users to delete
    const usersToDelete = await db.query(
      "SELECT id, email FROM users WHERE LOWER(email) NOT IN ('admin@ricoz.test', 'ricoz@admin.test')"
    );
    console.log(`Found ${usersToDelete.rows.length} accounts to delete.`);

    if (usersToDelete.rows.length > 0) {
      const userIds = usersToDelete.rows.map(u => u.id);

      // Explicitly delete dataset_rows for datasets belonging to these users first, to be clean and fast
      console.log('Cleaning up child dataset_rows for non-admin datasets...');
      await db.query(`
        DELETE FROM dataset_rows 
        WHERE dataset_id IN (
          SELECT id FROM datasets WHERE user_id = ANY($1)
        )
      `, [userIds]);
      console.log('Dataset rows deleted.');

      console.log('Deleting datasets...');
      await db.query(`DELETE FROM datasets WHERE user_id = ANY($1)`, [userIds]);
      console.log('Datasets deleted.');

      console.log('Deleting non-admin users...');
      const delUsers = await db.query(
        "DELETE FROM users WHERE LOWER(email) NOT IN ('admin@ricoz.test', 'ricoz@admin.test')"
      );
      console.log(`Successfully deleted ${delUsers.rowCount} user accounts.`);
    }

    // 4. Verify remaining users
    const remaining = await db.query("SELECT id, name, email, role, status FROM users ORDER BY id ASC");
    console.log('\nRemaining Users in Database:');
    console.table(remaining.rows);

  } catch (err) {
    console.error('Cleanup Error:', err);
  } finally {
    process.exit(0);
  }
}

cleanup();
