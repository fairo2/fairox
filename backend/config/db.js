const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// PostgreSQL connection
// ✅ CORRECT - SSL Added
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
  
  // ✅ ADD THIS - CRITICAL FOR RENDER
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
pool.connect()
  .then(() => console.log('✅ PostgreSQL connected successfully'))
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check your .env file credentials!');
  });

module.exports = pool;