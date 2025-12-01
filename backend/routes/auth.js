// ============================================
// COMPLETE AUTH ROUTES - PRODUCTION READY
// File: routes/auth.js
// Database: PostgreSQL (exports pool directly)
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// ✅ FIXED: Import pool directly (NOT destructured)
// Your config/db.js exports: module.exports = pool;
const pool = require('../config/db');

const router = express.Router();

// ✅ Verify database connection on startup
try {
  if (!pool || typeof pool.query !== 'function') {
    console.error('❌ FATAL: Database pool not properly initialized');
    process.exit(1);
  }
  console.log('✅ Database pool connected\n');
} catch (error) {
  console.error('❌ Database error:', error.message);
  process.exit(1);
}

// ✅ Import auth middleware
const { authMiddleware } = require('../middleware/auth');

console.log('✅ Auth routes loaded');

// ============================================
// EMAIL CONFIGURATION
// ============================================

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendEmail(to, subject, html) {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      html: html
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
}

// ============================================
// TEST ROUTE
// ============================================

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ADMIN LOGIN
// ============================================

router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('🔍 ADMIN LOGIN');
    console.log('='.repeat(60));
    console.log('Email:', email);
    console.log('Password received:', !!password);

    // Validation
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }

    console.log('\n[STEP 1] Database query...');
    const result = await pool.query(
      'SELECT id, name, email, password, is_admin, is_approved FROM users WHERE email = $1 AND is_admin = $2',
      [email, true]
    );

    const users = result.rows;
    console.log('Rows found:', users.length);

    if (!users || users.length === 0) {
      console.log('❌ No admin found');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    const admin = users[0];
    console.log('✅ Admin found:', admin.email);
    console.log('is_approved:', admin.is_approved);

    // Check approval
    if (!admin.is_approved) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not approved yet'
      });
    }

    console.log('\n[STEP 2] Password verification...');
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    console.log('Password match:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    console.log('\n[STEP 3] Generating token...');
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        is_admin: true
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '24h' }
    );
    console.log('✅ Token generated');

    console.log('✅ LOGIN SUCCESSFUL\n');

    res.json({
      success: true,
      message: 'Admin login successful',
      token: token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        is_admin: true
      }
    });

  } catch (error) {
    console.error('\n❌ Admin login error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// ============================================
// USER REGISTRATION
// ============================================

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log('\n📝 Registration attempt:', email);

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows && existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await pool.query(
      'INSERT INTO users (name, email, password, is_approved, is_admin) VALUES ($1, $2, $3, $4, $5)',
      [name, email, hashedPassword, false, false]
    );

    console.log('✅ User registered:', email);

    // Send admin notification
    await sendEmail(
      process.env.EMAIL_FROM,
      '🔔 New User Registration - Approval Required',
      `
        <h2>New User Registration</h2>
        <p>A new user has registered and is pending your approval:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Registration Date:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <p>Please login to the admin panel to approve or reject this user.</p>
        <hr>
        <p><em>This is an automated message from Fairox Management System</em></p>
      `
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval. You will be notified via email once approved.'
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// ============================================
// USER LOGIN
// ============================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n🔐 Login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const users = result.rows;

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Check if approved (allow if admin or approved)
    if (!user.is_approved && !user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait for approval notification.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin || false
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful:', email);

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// ============================================
// GET CURRENT USER
// ============================================

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    const users = result.rows;

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// ============================================
// CONTACT FORM
// ============================================

router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    console.log('📧 Contact form submission from:', email);

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Save to database
    await pool.query(
      'INSERT INTO contacts (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5)',
      [name, email, phone || null, subject, message]
    );

    // Send email to admin
    await sendEmail(
      process.env.EMAIL_FROM,
      `📧 New Contact Form: ${subject}`,
      `
        <h2>New Contact Form Submission</h2>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone || 'Not provided'}</li>
          <li><strong>Subject:</strong> ${subject}</li>
        </ul>
        <h3>Message:</h3>
        <p>${message}</p>
        <hr>
        <p><em>Received: ${new Date().toLocaleString()}</em></p>
      `
    );

    console.log('✅ Contact form saved');

    res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    });

  } catch (error) {
    console.error('❌ Contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get admin stats
router.get('/admin/stats', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  try {
    const pending = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_approved = $1 AND is_admin = $2', [false, false]);
    const approved = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_approved = $1 AND is_admin = $2', [true, false]);
    const total = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_admin = $1', [false]);
    const contacts = await pool.query('SELECT COUNT(*) as count FROM contacts');

    res.json({
      success: true,
      stats: {
        pending: parseInt(pending.rows[0].count),
        approved: parseInt(approved.rows[0].count),
        total: parseInt(total.rows[0].count),
        contacts: parseInt(contacts.rows[0].count)
      }
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get pending users
router.get('/admin/pending-users', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE is_approved = $1 AND is_admin = $2 ORDER BY created_at DESC',
      [false, false]
    );

    res.json({ success: true, users: result.rows });

  } catch (error) {
    console.error('❌ Pending users error:', error);
    res.status(500).json({ success: false });
  }
});

// Get approved users
router.get('/admin/approved-users', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, approved_at FROM users WHERE is_approved = $1 AND is_admin = $2 ORDER BY approved_at DESC',
      [true, false]
    );

    res.json({ success: true, users: result.rows });

  } catch (error) {
    console.error('❌ Approved users error:', error);
    res.status(500).json({ success: false });
  }
});

// Approve user
router.post('/admin/approve-user/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    // Update approval
    await pool.query(
      'UPDATE users SET is_approved = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
      [true, req.user.id, req.params.id]
    );

    // Send approval email
    await sendEmail(
      user.email,
      '✅ Your Fairox Account Has Been Approved!',
      `
        <h2>🎉 Welcome to Fairox!</h2>
        <p>Hi ${user.name},</p>
        <p>Great news! Your account has been approved by our admin team. You can now access all features of Fairox.</p>
        <ul>
          <li><strong>📧 Your Email:</strong> ${user.email}</li>
          <li><strong>✅ Status:</strong> APPROVED</li>
        </ul>
        <p><a href="https://fairox.co.in" style="background-color: #2a8f8e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now →</a></p>
        <hr>
        <p>If you have any questions, feel free to contact us at <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <p><em>© ${new Date().getFullYear()} Fairox. All rights reserved.</em></p>
      `
    );

    console.log('✅ User approved:', user.email);

    res.json({ success: true, message: 'User approved and notified via email' });

  } catch (error) {
    console.error('❌ Approve user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reject user
router.delete('/admin/reject-user/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1 AND is_admin = $2', [req.params.id, false]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1 AND is_admin = $2', [req.params.id, false]);

    // Send rejection email
    await sendEmail(
      user.email,
      '❌ Fairox Account Registration - Update',
      `
        <h2>Account Registration Update</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for your interest in Fairox. Unfortunately, we are unable to approve your account registration at this time.</p>
        <ul>
          <li><strong>📧 Email:</strong> ${user.email}</li>
          <li><strong>Status:</strong> NOT APPROVED</li>
        </ul>
        <p>If you believe this is an error or would like to discuss this further, please contact us at: <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <hr>
        <p><em>© ${new Date().getFullYear()} Fairox. All rights reserved.</em></p>
      `
    );

    console.log('✅ User rejected:', user.email);

    res.json({ success: true, message: 'User rejected and notified via email' });

  } catch (error) {
    console.error('❌ Reject user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Revoke user access
router.post('/admin/revoke-user/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    // Revoke approval
    await pool.query(
      'UPDATE users SET is_approved = $1, approved_by = NULL, approved_at = NULL WHERE id = $2',
      [false, req.params.id]
    );

    // Send revocation email
    await sendEmail(
      user.email,
      '⚠️ Fairox Account Access Revoked',
      `
        <h2>⚠️ Access Revoked</h2>
        <p>Hi ${user.name},</p>
        <p>This is to inform you that your access to Fairox has been temporarily revoked by our admin team.</p>
        <ul>
          <li><strong>📧 Your Email:</strong> ${user.email}</li>
          <li><strong>Status:</strong> ACCESS REVOKED</li>
        </ul>
        <p>You will not be able to login until your account is re-approved by an administrator.</p>
        <p>If you have any questions or concerns regarding this action, please contact our support team: <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <hr>
        <p><em>© ${new Date().getFullYear()} Fairox. All rights reserved.</em></p>
      `
    );

    console.log('✅ User access revoked:', user.email);

    res.json({ success: true, message: 'User access revoked and notified via email' });

  } catch (error) {
    console.error('❌ Revoke user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get contacts
router.get('/admin/contacts', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json({ success: true, contacts: result.rows });

  } catch (error) {
    console.error('❌ Contacts error:', error);
    res.status(500).json({ success: false });
  }
});

// ============================================
// CHANGE PASSWORD
// ============================================

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    console.log('🔐 Password change request - User:', userId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Get user
    const result = await pool.query('SELECT id, email, password FROM users WHERE id = $1', [userId]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

    console.log('✅ Password changed successfully for user:', user.email);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

// ============================================
// LOGOUT
// ============================================

router.get('/logout', authMiddleware, async (req, res) => {
  try {
    console.log('🔐 Logout request - User:', req.user.id);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

module.exports = router;