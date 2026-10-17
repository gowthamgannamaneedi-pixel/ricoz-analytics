const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function test() {
  try {
    const u1 = await db.query("SELECT id, name, email, role, status, password_hash FROM users WHERE LOWER(email) = 'admin@ricoz.test'");
    const u2 = await db.query("SELECT id, name, email, role, status, password_hash FROM users WHERE LOWER(email) = 'ricoz@admin.test'");

    console.log('User 1 (admin@ricoz.test):', u1.rows[0]);
    console.log('admin@ricoz.test password matches admin123:', bcrypt.compareSync('admin123', u1.rows[0].password_hash));

    console.log('\nUser 2 (ricoz@admin.test):', u2.rows[0]);
    console.log('ricoz@admin.test password matches admin123:', bcrypt.compareSync('admin123', u2.rows[0].password_hash));

    const totalUsers = await db.query("SELECT count(*) FROM users");
    console.log('\nTotal users in DB:', totalUsers.rows[0].count);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
