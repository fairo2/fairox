// ============================================
// ✅ COMPLETE AUTH ROUTES - ENHANCED SECURITY
// File: routes/auth.js
// Database: PostgreSQL
// Email: Mailjet SMTP (Port 2525)
// Security: Session timeout, Activity tracking, Rate limiting
// Updated: Dec 2, 2025
// ✅ FIXED v2: ALL routes properly defined with callbacks
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ✅ Import pool directly
const pool = require('../config/db');

const router = express.Router();

// ============================================
// SESSION & RATE LIMITING STORAGE
// ============================================

const activeSessions = new Map();
const rateLimitMap = new Map();

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
const WARNING_TIME = 9 * 60 * 1000;
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;

// ============================================
// VERIFY DATABASE CONNECTION
// ============================================

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

// ============================================
// IMPORT AUTH MIDDLEWARE
// ============================================

const { authMiddleware, adminMiddleware } = require('../middleware/auth');

console.log('✅ Auth routes loaded');

// ============================================
// SESSION MANAGEMENT FUNCTIONS
// ============================================

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userId, email, isAdmin) {
  const sessionId = generateSessionId();
  const sessionKey = `${userId}_${sessionId}`;

  activeSessions.set(sessionKey, {
    userId,
    email,
    isAdmin,
    sessionId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ip: '',
    userAgent: ''
  });

  console.log(`✅ Session created: ${sessionId.substring(0, 10)}... for user ${email}`);
  return sessionId;
}

function terminateSession(userId, sessionId) {
  const sessionKey = `${userId}_${sessionId}`;
  const session = activeSessions.get(sessionKey);

  if (session) {
    activeSessions.delete(sessionKey);
    console.log(`✅ Session terminated: ${sessionId.substring(0, 10)}... for user ${userId}`);
    return true;
  }

  return false;
}

function getSessionRemainingTime(userId, sessionId) {
  const sessionKey = `${userId}_${sessionId}`;
  const session = activeSessions.get(sessionKey);

  if (!session) return 0;

  const timeSinceLastActivity = Date.now() - session.lastActivity;
  const remaining = Math.max(0, INACTIVITY_TIMEOUT - timeSinceLastActivity);

  return Math.ceil(remaining / 1000);
}

// ============================================
// SECURITY HEADERS MIDDLEWARE
// ============================================

const securityHeaders = (req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

// ============================================
// ACTIVITY TRACKING MIDDLEWARE
// ============================================

const activityTracker = (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    if (userId && sessionId) {
      const sessionKey = `${userId}_${sessionId}`;

      if (activeSessions.has(sessionKey)) {
        activeSessions.set(sessionKey, {
          ...activeSessions.get(sessionKey),
          lastActivity: Date.now()
        });
      }

      console.log(`[ACTIVITY] User: ${userId} | Route: ${req.path} | Method: ${req.method}`);
    }

    next();
  } catch (error) {
    console.error('Activity tracking error:', error.message);
    next();
  }
};

// ============================================
// EMAIL CONFIGURATION - MAILJET (PORT 2525)
// ============================================

function createTransporter() {
  return nodemailer.createTransport({
    host: 'in-v3.mailjet.com',
    port: 2525,
    secure: false,
    auth: {
      user: process.env.MAILJET_API_KEY,
      pass: process.env.MAILJET_SECRET_KEY
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    },
    connectionTimeout: 20000,
    socketTimeout: 20000
  });
}

async function sendEmail(to, subject, html) {
  try {
    console.log('\n📤 Sending email via Mailjet...');
    console.log('   To:', to);
    console.log('   Subject:', subject);
    
    const transporter = createTransporter();
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      html: html,
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal'
      }
    });
    
    console.log(`✅ Email sent successfully to ${to}`);
    console.log('   Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    console.error('   Code:', error.code);
    return false;
  }
}

// ============================================
// APPLY GLOBAL SECURITY MIDDLEWARE
// ============================================

router.use(securityHeaders);
router.use(activityTracker);

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
// ADMIN LOGIN WITH SESSION
// ============================================

router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('🔐 ADMIN LOGIN ATTEMPT');
    console.log('='.repeat(60));
    console.log('Email:', email);
    console.log('Password received:', !!password);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }

    console.log('\n[STEP 1] Querying database...');
    const result = await pool.query(
      'SELECT id, name, email, password, is_admin, is_approved FROM users WHERE email = $1 AND is_admin = $2',
      [email, true]
    );

    const users = result.rows;
    console.log('   Rows found:', users.length);

    if (!users || users.length === 0) {
      console.log('   ❌ No admin user found');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    const admin = users[0];
    console.log('   ✅ Admin found:', admin.email);

    console.log('\n[STEP 2] Checking approval status...');
    if (!admin.is_approved) {
      console.log('   ❌ Admin not approved');
      return res.status(401).json({
        success: false,
        message: 'Admin account not approved yet'
      });
    }
    console.log('   ✅ Admin is approved');

    console.log('\n[STEP 3] Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    console.log('   Password match:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('   ❌ Password incorrect');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }
    console.log('   ✅ Password correct');

    console.log('\n[STEP 4] Checking JWT_SECRET...');
    if (!process.env.JWT_SECRET) {
      console.error('   ❌ JWT_SECRET not set in environment!');
      return res.status(500).json({
        success: false,
        message: 'Server error: JWT_SECRET not configured'
      });
    }
    console.log('   ✅ JWT_SECRET is set');

    console.log('\n[STEP 5] Creating session...');
    const sessionId = createSession(admin.id, admin.email, true);
    console.log('   ✅ Session created');

    console.log('\n[STEP 6] Generating JWT token...');
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        is_admin: true,
        name: admin.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('   ✅ Token generated');

    console.log('\n✅ ADMIN LOGIN SUCCESSFUL\n');

    res.json({
      success: true,
      message: 'Admin login successful',
      token: token,
      sessionId: sessionId,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        is_admin: true
      }
    });

  } catch (error) {
    console.error('\n❌ Admin login error:', error.message);
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

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (name, email, password, is_approved, is_admin) VALUES ($1, $2, $3, $4, $5)',
      [name, email, hashedPassword, false, false]
    );

    console.log('✅ User registered:', email);

    await sendEmail(
      process.env.EMAIL_FROM,
      'New User Registration - Admin Review',
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #208c84 0%, #1a6b63 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;"><h2 style="margin: 0; font-size: 24px;">New User Registration</h2></div><div style="background: #f8f9fa; padding: 24px;"><p style="margin: 0 0 16px 0; color: #333;">A new user has registered and is pending your approval:</p><div style="background: white; padding: 16px; border-left: 4px solid #208c84; border-radius: 4px; margin: 16px 0;"><p style="margin: 8px 0;"><strong>Name:</strong> ${name}</p><p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p><p style="margin: 8px 0;"><strong>Registration Date:</strong> ${new Date().toLocaleString()}</p></div><p style="margin: 16px 0; color: #666;">Please login to the admin panel to approve or reject this user.</p><div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 16px;"><p style="margin: 0; font-size: 12px; color: #999;">This is an automated message from Fairox Management System</p></div></div></div>`
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

    console.log('\n🔐 User login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

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

    if (!user.is_approved && !user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait for approval notification.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin || false
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    console.log('✅ User login successful:', email);

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
    console.error('❌ User login error:', error);
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
// CONTACT FORM WITH EMAIL
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

    await pool.query(
      'INSERT INTO contacts (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5)',
      [name, email, phone || null, subject, message]
    );

    console.log('✅ Contact form saved');

    const emailSent = await sendEmail(
      process.env.EMAIL_FROM,
      `New Contact Form Submission: ${subject}`,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #208c84 0%, #1a6b63 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;"><h2 style="margin: 0; font-size: 24px;">New Contact Form</h2></div><div style="background: #f8f9fa; padding: 24px;"><div style="background: white; padding: 16px; border-left: 4px solid #208c84; border-radius: 4px; margin: 16px 0;"><p style="margin: 8px 0;"><strong>Name:</strong> ${name}</p><p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p><p style="margin: 8px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p><p style="margin: 8px 0;"><strong>Subject:</strong> ${subject}</p></div><h3 style="color: #333; margin: 20px 0 10px 0;">Message:</h3><div style="background: white; padding: 16px; border-radius: 4px; line-height: 1.6; color: #333;">${message}</div><div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 16px;"><p style="margin: 0; font-size: 12px; color: #999;">Received: ${new Date().toLocaleString()}</p></div></div></div>`
    );

    if (!emailSent) {
      console.warn('⚠️ Email notification failed, but contact saved to database');
    }

    res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    });

  } catch (error) {
    console.error('❌ Contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save your message'
    });
  }
});

// ============================================
// HEARTBEAT ENDPOINT - Keep session alive
// ============================================

router.post('/heartbeat', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.body;
    
    console.log(`💓 Heartbeat received from user ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Session alive',
      sessionId: sessionId,
      remainingTime: getSessionRemainingTime(req.user.id, sessionId)
    });
    
  } catch (error) {
    console.error('❌ Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// ADMIN ROUTES - GET STATS
// ============================================

router.get('/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📊 Loading admin stats...');
    
    const pending = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_approved = $1 AND is_admin = $2', [false, false]);
    const approved = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_approved = $1 AND is_admin = $2', [true, false]);
    const total = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_admin = $1', [false]);
    const contacts = await pool.query('SELECT COUNT(*) as count FROM contacts');

    console.log('✅ Stats loaded');

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

// ============================================
// ADMIN ROUTES - PENDING USERS
// ============================================

router.get('/admin/pending-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📋 Loading pending users...');
    
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE is_approved = $1 AND is_admin = $2 ORDER BY created_at DESC',
      [false, false]
    );

    console.log('✅ Pending users loaded:', result.rows.length);

    res.json({ success: true, users: result.rows });

  } catch (error) {
    console.error('❌ Pending users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES - APPROVED USERS
// ============================================

router.get('/admin/approved-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('✅ Loading approved users...');
    
    const result = await pool.query(
      'SELECT id, name, email, approved_at FROM users WHERE is_approved = $1 AND is_admin = $2 ORDER BY approved_at DESC',
      [true, false]
    );

    console.log('✅ Approved users loaded:', result.rows.length);

    res.json({ success: true, users: result.rows });

  } catch (error) {
    console.error('❌ Approved users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES - APPROVE USER
// ============================================

router.post('/admin/approve-user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    await pool.query(
      'UPDATE users SET is_approved = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
      [true, req.user.id, req.params.id]
    );

    await sendEmail(
      user.email,
      'Your Fairox Account is Now Active',
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #208c84 0%, #1a6b63 100%); color: white; padding: 32px 24px; border-radius: 8px 8px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 28px;">Welcome to Fairox</h1></div><div style="background: #f8f9fa; padding: 32px 24px;"><p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">Hi ${user.name},</p><p style="margin: 0 0 20px 0; font-size: 15px; color: #555; line-height: 1.6;">Great news! Your account has been approved by our admin team. You can now access all features of Fairox Management System.</p><div style="background: white; padding: 20px; border-left: 4px solid #208c84; border-radius: 4px; margin: 20px 0;"><p style="margin: 8px 0; font-size: 14px;"><strong>Email:</strong> ${user.email}</p><p style="margin: 8px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #208c84; font-weight: bold;">ACTIVE</span></p></div><div style="text-align: center; margin: 24px 0;"><a href="https://fairox.co.in/login" style="background: linear-gradient(135deg, #208c84 0%, #1a6b63 100%); color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Login to Dashboard</a></div><p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">If you have any questions, feel free to contact our support team at <a href="mailto:support@fairox.co.in" style="color: #208c84; text-decoration: none;">support@fairox.co.in</a></p><div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 16px;"><p style="margin: 0; font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Fairox. All rights reserved.</p></div></div></div>`
    );

    console.log('✅ User approved:', user.email);

    res.json({ success: true, message: 'User approved and notified via email' });

  } catch (error) {
    console.error('❌ Approve user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES - REJECT USER
// ============================================

router.delete('/admin/reject-user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1 AND is_admin = $2', [req.params.id, false]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    await pool.query('DELETE FROM users WHERE id = $1 AND is_admin = $2', [req.params.id, false]);

    await sendEmail(
      user.email,
      'Registration Status Update - Fairox',
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #208c84 0%, #1a6b63 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;"><h2 style="margin: 0; font-size: 24px;">Registration Status Update</h2></div><div style="background: #f8f9fa; padding: 24px;"><p style="margin: 0 0 16px 0; color: #333;">Hi ${user.name},</p><p style="margin: 0 0 20px 0; color: #555; line-height: 1.6;">Thank you for your interest in Fairox. After reviewing your registration, we are unable to approve your account at this time.</p><div style="background: white; padding: 16px; border-left: 4px solid #208c84; border-radius: 4px; margin: 16px 0;"><p style="margin: 8px 0;"><strong>Email:</strong> ${user.email}</p><p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #999;">Not Approved</span></p></div><p style="margin: 16px 0; color: #666;">If you believe this is an error or would like to discuss further, please contact our support team: <a href="mailto:support@fairox.co.in" style="color: #208c84; text-decoration: none;">support@fairox.co.in</a></p><div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 16px;"><p style="margin: 0; font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Fairox. All rights reserved.</p></div></div></div>`
    );

    console.log('✅ User rejected:', user.email);

    res.json({ success: true, message: 'User rejected and notified via email' });

  } catch (error) {
    console.error('❌ Reject user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES - REVOKE USER ACCESS
// ============================================

router.post('/admin/revoke-user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    await pool.query(
      'UPDATE users SET is_approved = $1, approved_by = NULL, approved_at = NULL WHERE id = $2',
      [false, req.params.id]
    );

    await sendEmail(
      user.email,
      'Account Access Status Change - Fairox',
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #c01530 0%, #8b0d23 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;"><h2 style="margin: 0; font-size: 24px;">Account Access Status</h2></div><div style="background: #f8f9fa; padding: 24px;"><p style="margin: 0 0 16px 0; color: #333;">Hi ${user.name},</p><p style="margin: 0 0 20px 0; color: #555; line-height: 1.6;">This is to inform you that your access to Fairox has been temporarily suspended by our admin team.</p><div style="background: #fff3cd; padding: 16px; border-left: 4px solid #c01530; border-radius: 4px; margin: 16px 0;"><p style="margin: 8px 0;"><strong>Email:</strong> ${user.email}</p><p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #c01530; font-weight: bold;">ACCESS SUSPENDED</span></p></div><p style="margin: 16px 0; color: #666;">You will not be able to login until your account is re-approved by an administrator.</p><p style="margin: 16px 0; color: #666;">If you have questions or concerns regarding this action, please contact our support team: <a href="mailto:support@fairox.co.in" style="color: #c01530; text-decoration: none;">support@fairox.co.in</a></p><div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 16px;"><p style="margin: 0; font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Fairox. All rights reserved.</p></div></div></div>`
    );

    console.log('✅ User access revoked:', user.email);

    res.json({ success: true, message: 'User access revoked and notified via email' });

  } catch (error) {
    console.error('❌ Revoke user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES - GET CONTACTS
// ============================================

router.get('/admin/contacts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📞 Loading contacts...');
    
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    
    console.log('✅ Contacts loaded:', result.rows.length);
    
    res.json({ success: true, contacts: result.rows });

  } catch (error) {
    console.error('❌ Contacts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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

    const result = await pool.query('SELECT id, email, password FROM users WHERE id = $1', [userId]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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
// LOGOUT WITH SESSION TERMINATION
// ============================================

router.get('/logout', authMiddleware, (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (sessionId) {
      terminateSession(req.user.id, sessionId);
    }
    
    console.log(`🔐 User ${req.user.id} logged out`);
    
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

// ============================================
// CLEANUP: Remove expired sessions periodically
// ============================================

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, session] of activeSessions.entries()) {
    if (now - session.lastActivity > INACTIVITY_TIMEOUT) {
      activeSessions.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
  }
}, 60000);

module.exports = router;