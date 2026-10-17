const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function freshCleanup() {
  console.log('================================================================');
  console.log('🧹 RICOZANALYTICS FRESH REGISTRATION PURGE (ONLY admin@ricoz.test)');
  console.log('================================================================\n');

  try {
    const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
    const defaultOrgId = '00000000-0000-0000-0000-000000000001';

    // 1. Ensure Primary Organization exists
    console.log('1. Ensuring primary organization exists...');
    const orgCheck = await db.query("SELECT id FROM organizations WHERE id = $1", [defaultOrgId]);
    if (orgCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, trial_ends_at, created_at, updated_at)
        VALUES ($1, 'Ricoz Primary Organization', 'ricoz-primary', 'enterprise', 'active', 'paid', '2026-12-31 23:59:59+00', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET 
          plan = 'enterprise', 
          subscription_status = 'active', 
          payment_status = 'paid',
          updated_at = NOW()
      `, [defaultOrgId]);
      console.log('   ✅ Primary organization created/updated');
    } else {
      await db.query(`
        UPDATE organizations 
        SET plan = 'enterprise', subscription_status = 'active', payment_status = 'paid', updated_at = NOW()
        WHERE id = $1
      `, [defaultOrgId]);
      console.log('   ✅ Primary organization refreshed');
    }

    // 2. Refresh or create admin@ricoz.test to completely fresh state
    console.log('2. Refreshing admin@ricoz.test account...');
    const adminCheck = await db.query("SELECT id, organization_id FROM users WHERE LOWER(email) = 'admin@ricoz.test'");
    let targetOrgId = defaultOrgId;

    if (adminCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO users (
          name, email, password_hash, role, organization_id, status,
          verification_token, verification_otp, verification_token_expires_at,
          reset_password_token, reset_password_expires_at, email_verified_at,
          last_login_at, created_at, updated_at
        )
        VALUES (
          'Gowtham (Admin)', 'admin@ricoz.test', $1, 'admin', $2, 'active',
          NULL, NULL, NULL,
          NULL, NULL, NOW(),
          NULL, NOW(), NOW()
        )
      `, [defaultPasswordHash, targetOrgId]);
      console.log('   ✅ Created fresh admin@ricoz.test');
    } else {
      if (adminCheck.rows[0].organization_id) {
        targetOrgId = adminCheck.rows[0].organization_id;
      }
      await db.query(`
        UPDATE users 
        SET 
          name = 'Gowtham (Admin)',
          role = 'admin',
          status = 'active',
          password_hash = $1,
          organization_id = $2,
          verification_token = NULL,
          verification_otp = NULL,
          verification_token_expires_at = NULL,
          reset_password_token = NULL,
          reset_password_expires_at = NULL,
          email_verified_at = NOW(),
          last_login_at = NULL,
          updated_at = NOW()
        WHERE LOWER(email) = 'admin@ricoz.test'
      `, [defaultPasswordHash, targetOrgId]);
      console.log('   ✅ Updated admin@ricoz.test to completely fresh state');
    }

    // 3. Clean up non-admin dataset_rows and datasets to avoid statement timeout
    console.log('3. Cleaning up child data for non-admin registrations...');
    try {
      await db.query(`
        DELETE FROM dataset_rows 
        WHERE dataset_id IN (
          SELECT id FROM datasets 
          WHERE user_id IN (
            SELECT id FROM users WHERE LOWER(email) != 'admin@ricoz.test'
          )
        )
      `);
    } catch (e) {
      console.warn('   ⚠️ Warning cleaning dataset_rows:', e.message);
    }

    try {
      await db.query(`
        DELETE FROM datasets 
        WHERE user_id IN (
          SELECT id FROM users WHERE LOWER(email) != 'admin@ricoz.test'
        )
      `);
    } catch (e) {
      console.warn('   ⚠️ Warning cleaning datasets:', e.message);
    }

    // 4. Delete all other user registrations except admin@ricoz.test
    console.log('4. Purging all registrations except admin@ricoz.test...');
    const delUsers = await db.query(
      "DELETE FROM users WHERE LOWER(email) != 'admin@ricoz.test'"
    );
    console.log(`   ✅ Deleted ${delUsers.rowCount} non-admin user registrations.`);

    // 5. Clean invitations
    console.log('5. Purging pending invitations...');
    const delInv = await db.query("DELETE FROM invitations");
    console.log(`   ✅ Deleted ${delInv.rowCount} invitations.`);

    // 6. Clean up test tenant organizations (keep only primary organization)
    console.log('6. Cleaning up test tenant organizations...');
    try {
      // Find organizations not linked to admin@ricoz.test
      const delOrgs = await db.query(`
        DELETE FROM organizations 
        WHERE id != $1 AND id NOT IN (
          SELECT organization_id FROM users WHERE organization_id IS NOT NULL
        )
      `, [defaultOrgId]);
      console.log(`   ✅ Cleaned up ${delOrgs.rowCount} test tenant organizations.`);
    } catch (e) {
      console.warn('   ⚠️ Warning cleaning organizations:', e.message);
    }

    // 7. Verify remaining state
    console.log('\n================================================================');
    console.log('📊 DATABASE VERIFICATION AFTER FRESH PURGE:');
    console.log('================================================================');

    const remainingUsers = await db.query("SELECT id, name, email, role, status, email_verified_at, created_at, updated_at FROM users");
    console.log('\nRemaining Users (Must be ONLY admin@ricoz.test):');
    console.table(remainingUsers.rows);

    const remainingOrgs = await db.query("SELECT id, name, slug, plan, subscription_status FROM organizations");
    console.log('\nRemaining Organizations:');
    console.table(remainingOrgs.rows);

    const userCount = remainingUsers.rows.length;
    if (userCount === 1 && remainingUsers.rows[0].email.toLowerCase() === 'admin@ricoz.test') {
      console.log('\n🎉 SUCCESS: exactly 1 user exists: admin@ricoz.test in fresh state!');
    } else {
      console.error('\n❌ FAILURE: unexpected users found:', remainingUsers.rows);
    }

  } catch (err) {
    console.error('❌ Fresh Cleanup Error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

freshCleanup();
