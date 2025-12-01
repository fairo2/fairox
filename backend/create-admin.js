// ============================================
// CREATE ADMIN USER SCRIPT
// File: create-admin.js
// Run: npm run create-admin
// ============================================

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

async function createAdmin() {
  const password = 'Admin@123';
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  ✅ CREATING ADMIN USER                ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log('🔐 Password hashing complete...\n');

  // PostgreSQL connection
  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...\n');
    const connection = await pool.connect();
    console.log('✅ Database connected\n');

    // Delete old admin if exists
    console.log('🗑️  Removing old admin user if exists...\n');
    await connection.query(
      'DELETE FROM users WHERE email = $1',
      ['admin@fairox.co.in']
    );

    // Insert new admin
    console.log('📝 Creating new admin user...\n');
    const result = await connection.query(
      'INSERT INTO users (name, email, password, is_approved, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, is_admin, is_approved',
      ['Admin User', 'admin@fairox.co.in', hashedPassword, true, true]
    );

    const admin = result.rows[0];

    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ ADMIN USER CREATED SUCCESSFULLY    ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  ID:', admin.id);
    console.log('║  Name:', admin.name);
    console.log('║  Email:', admin.email);
    console.log('║  is_admin:', admin.is_admin);
    console.log('║  is_approved:', admin.is_approved);
    console.log('╠════════════════════════════════════════╣');
    console.log('║  LOGIN CREDENTIALS:                     ║');
    console.log('║  📧 Email: admin@fairox.co.in          ║');
    console.log('║  🔑 Password: Admin@123                ║');
    console.log('╚════════════════════════════════════════╝\n');

    connection.release();
    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creating admin user:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('\n⚠️  Make sure:');
    console.error('   1. Database credentials are correct in .env');
    console.error('   2. Database is running and accessible');
    console.error('   3. users table exists in database\n');
    
    await pool.end();
    process.exit(1);
  }
}

createAdmin();