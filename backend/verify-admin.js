const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function verifyAdmin() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🔍 ADMIN VERIFICATION                 ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Get admin from database
    const result = await pool.query(
      'SELECT id, name, email, password, is_admin, is_approved FROM users WHERE email = $1 AND is_admin = $2',
      ['admin@fairox.co.in', true]
    );

    if (result.rows.length === 0) {
      console.log('❌ No admin found!\n');
      await pool.end();
      return;
    }

    const admin = result.rows[0];
    console.log('✅ Admin found:');
    console.log('   ID:', admin.id);
    console.log('   Email:', admin.email);
    console.log('   is_admin:', admin.is_admin);
    console.log('   is_approved:', admin.is_approved);
    console.log('   Password hash:', admin.password.substring(0, 20) + '...\n');

    // Test password
    const testPassword = 'Admin@123';
    const isMatch = await bcrypt.compare(testPassword, admin.password);

    console.log('🔐 Testing password...');
    console.log('   Password: ' + testPassword);
    console.log('   Match: ' + (isMatch ? '✅ YES' : '❌ NO') + '\n');

    if (!isMatch) {
      console.log('❌ PASSWORD MISMATCH!\n');
      console.log('🔧 Generating correct password hash...\n');

      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('New hash: ' + newHash + '\n');

      console.log('✅ Updating database...\n');
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [newHash, 'admin@fairox.co.in']
      );

      console.log('✅ Password updated!\n');
      console.log('Try login with:');
      console.log('   Email: admin@fairox.co.in');
      console.log('   Password: Admin@123\n');
    } else {
      console.log('✅ PASSWORD IS CORRECT!');
      console.log('   Email: admin@fairox.co.in');
      console.log('   Password: Admin@123\n');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

verifyAdmin();
