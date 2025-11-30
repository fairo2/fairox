const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function createAdmin() {
  // Your password (change this to whatever you want)
  const password = 'Admin@123';
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log('Password Hash:', hashedPassword);
  
  // Database connection
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Vaseemterminal@092025', // Your MySQL password
    database: 'fairox_db'
  });
  
  // Delete old admin if exists
  await connection.execute('DELETE FROM users WHERE email = ?', ['admin@fairox.co.in']);
  
  // Insert new admin
  await connection.execute(
    'INSERT INTO users (name, email, password, is_approved, is_admin) VALUES (?, ?, ?, ?, ?)',
    ['Admin User', 'admin@fairox.co.in', hashedPassword, 1, 1]
  );
  
  console.log('✅ Admin user created successfully!');
  console.log('Email: admin@fairox.co.in');
  console.log('Password:', password);
  
  await connection.end();
  process.exit(0);
}

createAdmin().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
