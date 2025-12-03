const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }  // ← IMPORTANT for Render
});

async function createAdminLogsTable() {
  try {
    console.log('🔄 Checking admin_logs table...');
    
    const checkQuery = `SELECT to_regclass('public.admin_logs');`;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows[0].to_regclass) {
      console.log('✅ Table admin_logs already exists');
      await pool.end();
      process.exit(0);
      return;
    }
    
    console.log('📝 Creating admin_logs table...');
    
    await pool.query(`
      CREATE TABLE admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(255) NOT NULL,
        target_user_id INTEGER,
        details TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Table created successfully');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
    `);
    
    console.log('✅ Indexes created');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createAdminLogsTable();
