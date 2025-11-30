const nodemailer = require('nodemailer');

console.log('===== NODEMAILER DIAGNOSTIC TEST =====');
console.log('1. nodemailer type:', typeof nodemailer);
console.log('2. nodemailer object:', nodemailer);
console.log('3. createTransporter type:', typeof nodemailer.createTransporter);
console.log('4. Available methods:', Object.keys(nodemailer));
console.log('=====================================');

if (typeof nodemailer.createTransporter === 'function') {
  console.log('✅ nodemailer.createTransporter EXISTS!');
  
  const transporter = nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'realm74st@gmail.com',
      pass: 'suvf whdp btil sdjg'
    }
  });
  
  console.log('✅ Transporter created successfully!');
} else {
  console.log('❌ nodemailer.createTransporter is NOT a function!');
  console.log('❌ This means nodemailer package is CORRUPTED or WRONG VERSION');
}
