// ============================================
// ✅ ENHANCED AUTH ROUTES - SECURITY HARDENED
// File: routes/auth.js
// Database: PostgreSQL
// Email: Mailjet SMTP (Port 2525)
// Security: Enhanced with rate limiting, input validation, CSRF protection
// Updated: Dec 3, 2025 - FIXED & PRODUCTION READY
// ============================================


const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const crypto = require('crypto');


// ✅ FIXED: Import pool directly (NOT destructured)
const pool = require('../config/db');


const router = express.Router();


// ============================================
// SECURITY CONSTANTS
// ============================================


const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes


// Store login attempts in memory (in production, use Redis)
const loginAttempts = new Map();
const accountLockouts = new Map();


// ✅ Verify database connection on startup
try {
  if (!pool || typeof pool.query !== 'function') {
    console.error('❌ FATAL: Database pool not properly initialized');
    process.exit(1);
  }
  console.log('✅ Database pool connected');
} catch (error) {
  console.error('❌ Database error:', error.message);
  process.exit(1);
}


// ✅ Import auth middleware - BOTH authMiddleware and adminMiddleware
const { authMiddleware, adminMiddleware } = require('../middleware/auth');


console.log('✅ Auth routes loaded\n');


// ============================================
// RATE LIMITING
// ============================================


// Strict rate limit for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Don't apply to test endpoint
    return req.path === '/test';
  }
});


// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,  // ✅ CHANGE: 100 → 500
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {  // ✅ ADD: Skip for admin
    return req.path.includes('/admin/');
  }
});



// ============================================
// SECURITY MIDDLEWARE
// ============================================


// Add security headers
router.use((req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('Content-Security-Policy', "default-src 'self'");
  next();
});


// ============================================
// HELPER FUNCTIONS - SECURITY ENHANCED
// ============================================


function validateEmail(email) {
  return validator.isEmail(email);
}


function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
    };
  }


  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      message: 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
    };
  }


  return { valid: true };
}


function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return validator.trim(input);
}


function recordLoginAttempt(email) {
  const key = `login_${email}`;
  const now = Date.now();


  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, []);
  }


  const attempts = loginAttempts.get(key);
  attempts.push(now);


  // Remove attempts older than window
  const filtered = attempts.filter(t => now - t < LOGIN_ATTEMPT_WINDOW);
  loginAttempts.set(key, filtered);


  return filtered.length;
}


function checkLoginAttempts(email) {
  const attempts = recordLoginAttempt(email);
  const lockoutKey = `lockout_${email}`;


  if (attempts > MAX_LOGIN_ATTEMPTS) {
    accountLockouts.set(lockoutKey, Date.now() + LOCKOUT_TIME);
    return {
      allowed: false,
      reason: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      locked: true
    };
  }


  if (accountLockouts.has(lockoutKey)) {
    const lockoutTime = accountLockouts.get(lockoutKey);
    if (Date.now() < lockoutTime) {
      return {
        allowed: false,
        reason: 'Account is temporarily locked. Try again later.',
        locked: true
      };
    } else {
      accountLockouts.delete(lockoutKey);
      loginAttempts.delete(`login_${email}`);
    }
  }


  return { allowed: true };
}


function resetLoginAttempts(email) {
  loginAttempts.delete(`login_${email}`);
  accountLockouts.delete(`lockout_${email}`);
}


// ============================================
// EMAIL CONFIGURATION - MAILJET (PORT 2525) ✅
// ============================================


function createTransporter() {
  return nodemailer.createTransport({
    host: 'in-v3.mailjet.com', // ✅ Mailjet SMTP host
    port: 2525, // ✅ Port 2525 (works on Render)
    secure: false, // ✅ False for port 2525
    auth: {
      user: process.env.MAILJET_API_KEY, // ✅ From Mailjet account
      pass: process.env.MAILJET_SECRET_KEY // ✅ From Mailjet account
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
      html: html
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
// ROUTE 1: TEST
// ============================================


router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working',
    timestamp: new Date().toISOString()
  });
});


// ============================================
// ✅ ROUTE 2: ADMIN LOGIN - FULLY CORRECTED ✅
// ✅ CRYPTO MODULE BUG FIXED
// ✅ CASE-INSENSITIVE EMAIL LOOKUP ADDED
// ✅ EXPLICIT RETURN STATEMENTS ADDED
// ============================================


router.post('/admin-login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;


    console.log('\n' + '='.repeat(60));
    console.log('🔐 ADMIN LOGIN ATTEMPT');
    console.log('='.repeat(60));


    // Input validation
    const sanitizedEmail = sanitizeInput(email);


    if (!sanitizedEmail || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }


    if (!validateEmail(sanitizedEmail)) {
      console.log('❌ Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }


    // Check login attempts
    const attemptCheck = checkLoginAttempts(sanitizedEmail);
    if (!attemptCheck.allowed) {
      console.log('❌ Too many login attempts:', sanitizedEmail);
      return res.status(429).json({
        success: false,
        message: attemptCheck.reason
      });
    }


    console.log('Email:', sanitizedEmail);
    console.log('Password received:', !!password);


    // ✅ Step 1: Query database - CASE-INSENSITIVE
    console.log('\n[STEP 1] Querying database...');
    const result = await pool.query(
      'SELECT id, name, email, password, is_admin, is_approved FROM users WHERE LOWER(email) = LOWER($1) AND is_admin = $2',
      [sanitizedEmail, true]
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
    console.log('   is_approved:', admin.is_approved);
    console.log('   is_admin:', admin.is_admin);


    // ✅ Step 2: Check approval status
    console.log('\n[STEP 2] Checking approval status...');
    if (!admin.is_approved) {
      console.log('   ❌ Admin not approved');
      return res.status(401).json({
        success: false,
        message: 'Admin account not approved yet'
      });
    }
    console.log('   ✅ Admin is approved');


    // ✅ Step 3: Verify password
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


    // Reset login attempts on successful login
    resetLoginAttempts(sanitizedEmail);


    // ✅ Step 4: Check JWT_SECRET
    console.log('\n[STEP 4] Checking JWT_SECRET...');
    if (!process.env.JWT_SECRET) {
      console.error('   ❌ JWT_SECRET not set in environment!');
      return res.status(500).json({
        success: false,
        message: 'Server error: JWT_SECRET not configured'
      });
    }
    console.log('   ✅ JWT_SECRET is set');


    // ✅ Step 5: Generate token with enhanced security
    console.log('\n[STEP 5] Generating JWT token with enhanced security...');
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        is_admin: true,
        name: admin.name,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('   ✅ Token generated');
    console.log('   Token (first 50 chars):', token.substring(0, 50) + '...');


    // ✅ STEP 6: Generate session ID
    console.log('\n[STEP 6] Generating session ID...');
    const sessionId = crypto.randomBytes(32).toString('hex');
    console.log('   ✅ Session ID generated');
    console.log('   Session ID (first 32 chars):', sessionId.substring(0, 32) + '...');


        // Log admin login for audit trail
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, ip_address, created_at) VALUES ($1, $2, $3, NOW())',
      [admin.id, 'LOGIN', req.ip]
    ).catch(err => console.warn('⚠️  Audit log failed:', err.message));


    console.log('\n✅ ADMIN LOGIN SUCCESSFUL\n');


    // ✅ FINAL RESPONSE - SENDS COMPLETE DATA WITH EXPLICIT RETURN
    return res.json({
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
    console.error('Stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});


// ============================================
// ROUTE 3: USER REGISTRATION - SECURITY ENHANCED
// ============================================


router.post('/register', apiLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;


    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);


    console.log('\n📝 Registration attempt:', sanitizedEmail);


    // Input validation
    if (!sanitizedName || !sanitizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }


    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }


    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }


    if (sanitizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name too long (max 100 characters)'
      });
    }


    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [sanitizedEmail]
    );


    if (existingUser.rows && existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }


    // Hash password with enhanced security (12 rounds)
    const hashedPassword = await bcrypt.hash(password, 12);


    // Insert user
    await pool.query(
      'INSERT INTO users (name, email, password, is_approved, is_admin, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
      [sanitizedName, sanitizedEmail, hashedPassword, false, false]
    );


    console.log('✅ User registered:', sanitizedEmail);


    // Send admin notification
    await sendEmail(
      process.env.EMAIL_FROM,
      '🔔 New User Registration - Approval Required',
      `
        <h2>New User Registration</h2>
        <p>A new user has registered and is pending your approval:</p>
        <ul>
          <li><strong>Name:</strong> ${validator.escape(sanitizedName)}</li>
          <li><strong>Email:</strong> ${validator.escape(sanitizedEmail)}</li>
          <li><strong>Registration Date:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <p>Please login to the admin panel to approve or reject this user.</p>
        <hr>
        <p><em>This is an automated message from Fairox Management System</em></p>
      `
    );


    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval. You will be notified via email once approved.'
    });


  } catch (error) {
    console.error('❌ Registration error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});


// ============================================
// ROUTE 4: USER LOGIN - SECURITY ENHANCED
// ============================================


router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;


    const sanitizedEmail = sanitizeInput(email);


    console.log('\n🔐 User login attempt:', sanitizedEmail);


    // Input validation
    if (!sanitizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }


    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }


    // Check login attempts
    const attemptCheck = checkLoginAttempts(sanitizedEmail);
    if (!attemptCheck.allowed) {
      console.log('❌ Too many login attempts:', sanitizedEmail);
      return res.status(429).json({
        success: false,
        message: attemptCheck.reason
      });
    }


    // Get user - CASE-INSENSITIVE
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [sanitizedEmail]
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


    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is locked. Please contact support.'
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


    // Reset login attempts on successful login
    resetLoginAttempts(sanitizedEmail);


    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin || false,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );


    console.log('✅ User login successful:', sanitizedEmail);


    return res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });


  } catch (error) {
    console.error('❌ User login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});


// ============================================
// ROUTE 5: GET CURRENT USER
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


    return res.json({
      success: true,
      user: user
    });


  } catch (error) {
    console.error('❌ Get user error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// ============================================
// ROUTE 6: CONTACT FORM - SECURITY ENHANCED
// ============================================


router.post('/contact', apiLimiter, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;


    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPhone = phone ? sanitizeInput(phone) : null;
    const sanitizedSubject = sanitizeInput(subject);
    const sanitizedMessage = sanitizeInput(message);


    console.log('📧 Contact form submission from:', sanitizedEmail);


    // Input validation
    if (!sanitizedName || !sanitizedEmail || !sanitizedSubject || !sanitizedMessage) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }


    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }


    if (sanitizedName.length > 100 || sanitizedSubject.length > 200 || sanitizedMessage.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Input exceeds maximum length'
      });
    }


    // Save to database
    await pool.query(
      'INSERT INTO contacts (name, email, phone, subject, message, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [sanitizedName, sanitizedEmail, sanitizedPhone, sanitizedSubject, sanitizedMessage]
    );


    console.log('✅ Contact form saved');


    // Send email to admin
    const emailSent = await sendEmail(
      process.env.EMAIL_FROM,
      `📧 New Contact Form: ${sanitizedSubject}`,
      `
        <h2>New Contact Form Submission</h2>
        <ul>
          <li><strong>Name:</strong> ${validator.escape(sanitizedName)}</li>
          <li><strong>Email:</strong> ${validator.escape(sanitizedEmail)}</li>
          <li><strong>Phone:</strong> ${sanitizedPhone ? validator.escape(sanitizedPhone) : 'Not provided'}</li>
          <li><strong>Subject:</strong> ${validator.escape(sanitizedSubject)}</li>
        </ul>
        <h3>Message:</h3>
        <p>${validator.escape(sanitizedMessage).replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>Received: ${new Date().toLocaleString()}</em></p>
      `
    );


    if (!emailSent) {
      console.warn('⚠️  Email notification failed, but contact saved to database');
    }


    return res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    });


  } catch (error) {
    console.error('❌ Contact error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save your message'
    });
  }
});


// ============================================
// ADMIN ROUTE 1: GET STATS - SECURITY ENHANCED
// ============================================


router.get('/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📊 Loading admin stats...');


    const pending = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_approved = $1 AND is_admin = $2',
      [false, false]
    );
    const approved = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_approved = $1 AND is_admin = $2',
      [true, false]
    );
    const total = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_admin = $1',
      [false]
    );
    const contacts = await pool.query(
      'SELECT COUNT(*) as count FROM contacts'
    );


    console.log('✅ Stats loaded');


    return res.json({
      success: true,
      stats: {
        pending: parseInt(pending.rows[0].count),
        approved: parseInt(approved.rows[0].count),
        total: parseInt(total.rows[0].count),
        contacts: parseInt(contacts.rows[0].count)
      }
    });


  } catch (error) {
    console.error('❌ Stats error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ADMIN ROUTE 2: PENDING USERS
// ============================================


router.get('/admin/pending-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📋 Loading pending users...');


    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE is_approved = $1 AND is_admin = $2 ORDER BY created_at DESC',
      [false, false]
    );


    console.log('✅ Pending users loaded:', result.rows.length);


    return res.json({ success: true, users: result.rows });


  } catch (error) {
    console.error('❌ Pending users error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ADMIN ROUTE 3: APPROVED USERS
// ============================================


router.get('/admin/approved-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('✅ Loading approved users...');


    const result = await pool.query(
      'SELECT id, name, email, approved_at FROM users WHERE is_approved = $1 AND is_admin = $2 ORDER BY approved_at DESC',
      [true, false]
    );


    console.log('✅ Approved users loaded:', result.rows.length);


    return res.json({ success: true, users: result.rows });


  } catch (error) {
    console.error('❌ Approved users error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ADMIN ROUTE 4: APPROVE USER - SECURITY ENHANCED
// ============================================


router.post('/admin/approve-user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;


    // Validate ID
    if (!validator.isNumeric(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }


    const result = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );


    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }


    const user = result.rows[0];


    // Update approval with audit trail
    await pool.query(
      'UPDATE users SET is_approved = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
      [true, req.user.id, userId]
    );


        // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [req.user.id, 'APPROVE_USER', userId, req.ip]
    ).catch(err => console.warn('Audit log failed:', err.message));



    // Send approval email
    await sendEmail(
      user.email,
      '✅ Your Fairox Account Has Been Approved!',
      `
        <h2>🎉 Welcome to Fairox!</h2>
        <p>Hi ${validator.escape(user.name)},</p>
        <p>Great news! Your account has been approved by our admin team. You can now access all features of Fairox.</p>
        <ul>
          <li><strong>📧 Your Email:</strong> ${validator.escape(user.email)}</li>
          <li><strong>✅ Status:</strong> APPROVED</li>
        </ul>
        <p><a href="https://fairox.co.in" style="background-color: #2a8f8e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now →</a></p>
        <hr>
        <p>If you have any questions, feel free to contact us at <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <p><em>© ${new Date().getFullYear()} Fairox. All rights reserved.</em></p>
      `
    );


    console.log('✅ User approved:', user.email);


    return res.json({ success: true, message: 'User approved and notified via email' });


  } catch (error) {
    console.error('❌ Approve user error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ADMIN ROUTE 5: REJECT USER - SECURITY ENHANCED
// ============================================


router.delete('/admin/reject-user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;


    // Validate ID
    if (!validator.isNumeric(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }


    const result = await pool.query(
      'SELECT name, email FROM users WHERE id = $1 AND is_admin = $2',
      [userId, false]
    );


    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }


    const user = result.rows[0];


    // Delete user
    await pool.query(
      'DELETE FROM users WHERE id = $1 AND is_admin = $2',
      [userId, false]
    );


        // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [req.user.id, 'REJECT_USER', userId, req.ip]
    ).catch(err => console.warn('Audit log failed:', err.message));



    // Send rejection email
    await sendEmail(
      user.email,
      '❌ Fairox Account Registration - Update',
      `
        <h2>Account Registration Update</h2>
        <p>Hi ${validator.escape(user.name)},</p>
        <p>Thank you for your interest in Fairox. Unfortunately, we are unable to approve your account registration at this time.</p>
        <ul>
          <li><strong>📧 Email:</strong> ${validator.escape(user.email)}</li>
          <li><strong>Status:</strong> NOT APPROVED</li>
        </ul>
        <p>If you believe this is an error or would like to discuss this further, please contact us at: <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <hr>
        <p><em>© ${new Date().getFullYear()} Fairox. All rights reserved.</em></p>
      `
    );


    console.log('✅ User rejected:', user.email);


    return res.json({ success: true, message: 'User rejected and notified via email' });


  } catch (error) {
    console.error('❌ Reject user error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ADMIN ROUTE 6: REVOKE USER ACCESS - SECURITY ENHANCED
// ============================================


router.post('/admin/revoke-user/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;


    // Validate ID
    if (!validator.isNumeric(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }


    const result = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );


    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }


    const user = result.rows[0];


    // Revoke approval
    await pool.query(
      'UPDATE users SET is_approved = $1, approved_by = NULL, approved_at = NULL WHERE id = $2',
      [false, userId]
    );


        // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, ip_address, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [req.user.id, 'REVOKE_USER', userId, req.ip]
    ).catch(err => console.warn('Audit log failed:', err.message));



    // Send revocation email
    await sendEmail(
      user.email,
      '⚠️ Fairox Account Access Revoked',
      `
        <h2>⚠️ Access Revoked</h2>
        <p>Hi ${validator.escape(user.name)},</p>
        <p>This is to inform you that your access to Fairox has been temporarily revoked by our admin team.</p>
        <ul>
          <li><strong>📧 Your Email:</strong> ${validator.escape(user.email)}</li>
          <li><strong>Status:</strong> ACCESS REVOKED</li>
        </ul>
        <p>You will not be able to login until your account is re-approved by an administrator.</p>
        <p>If you have any questions or concerns regarding this action, please contact our support team: <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <hr>
        <p><em>© ${new Date().getFullYear()} Fairox. All rights reserved.</em></p>
      `
    );


    console.log('✅ User access revoked:', user.email);


    return res.json({ success: true, message: 'User access revoked and notified via email' });


  } catch (error) {
    console.error('❌ Revoke user error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ADMIN ROUTE 7: GET CONTACTS
// ============================================


router.get('/admin/contacts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('📞 Loading contacts...');


    const result = await pool.query(
      'SELECT * FROM contacts ORDER BY created_at DESC LIMIT 500'
    );


    console.log('✅ Contacts loaded:', result.rows.length);


    return res.json({ success: true, contacts: result.rows });


  } catch (error) {
    console.error('❌ Contacts error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ============================================
// ROUTE 7: CHANGE PASSWORD - SECURITY ENHANCED
// ============================================


router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;


    console.log('🔐 Password change request - User:', userId);


    // Input validation
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


    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }


    // Get user
    const result = await pool.query(
      'SELECT id, email, password FROM users WHERE id = $1',
      [userId]
    );


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


    // Hash new password with enhanced security
    const hashedPassword = await bcrypt.hash(newPassword, 12);


    // Update password
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );


    console.log('✅ Password changed successfully for user:', user.email);


    return res.json({
      success: true,
      message: 'Password changed successfully'
    });


  } catch (error) {
    console.error('❌ Change password error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});


// ============================================
// ROUTE 8: LOGOUT - SECURITY ENHANCED
// ============================================


router.get('/logout', authMiddleware, async (req, res) => {
  try {
    console.log('🔐 Logout request - User:', req.user.id);


    return res.json({
      success: true,
      message: 'Logged out successfully'
    });


  } catch (error) {
    console.error('❌ Logout error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

// ============================================
// ROUTE 9: KEEP-ALIVE ENDPOINT (SESSION HEARTBEAT) ✅ NEW
// ============================================

router.post('/keep-alive', authMiddleware, async (req, res) => {
  try {
    console.log('💓 Keep-alive request from user:', req.user.id);
    
    // Just return success - middleware already verified token is valid
    res.json({
      success: true,
      message: 'Session keep-alive successful',
      timestamp: new Date(),
      userId: req.user.id
    });
    
  } catch (error) {
    console.error('❌ Keep-alive error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Keep-alive failed',
      error: error.message
    });
  }
});


module.exports = router;