const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

async function createAdmin() {
  // Your password (change this to whatever you want)
  const password = 'Admin@123';
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log('Password Hash:', hashedPassword);
  
  // ✅ FIXED: PostgreSQL connection using environment variables
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
    const connection = await pool.connect();
    
    // ✅ FIXED: PostgreSQL parameters ($1, $2, etc.)
    // Delete old admin if exists
    await connection.query(
      'DELETE FROM users WHERE email = $1',
      ['admin@fairox.co.in']
    );
    
    // Insert new admin
    await connection.query(
      'INSERT INTO users (name, email, password, is_approved, is_admin) VALUES ($1, $2, $3, $4, $5)',
      ['Admin User', 'admin@fairox.co.in', hashedPassword, true, true]
    );
    
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@fairox.co.in');
    console.log('Password:', password);
    console.log('Password Hash:', hashedPassword);
    
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

createAdmin();