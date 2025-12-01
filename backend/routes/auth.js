const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// Helper function to create email transporter
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

// Helper function to send email
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

// Admin login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ FIXED: ? → $1
    const [users] = await db.query('SELECT * FROM users WHERE email = $1 AND is_admin = 1', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized as admin'
      });
    }

    const admin = users;
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, is_admin: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        is_admin: true
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ✅ FIXED: ? → $1
    const [users] = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (users.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ FIXED: ? → $1, $2, $3, 0
    await db.query(
      'INSERT INTO users (name, email, password, is_approved) VALUES ($1, $2, $3, 0)',
      [name, email, hashedPassword]
    );

    // Send admin notification email
    await sendEmail(
      'support@fairox.co.in',
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
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ FIXED: ? → $1
    const [users] = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users;

    // Check if approved
    if (!user.is_approved && !user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait for approval notification.'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin || false },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // ✅ FIXED: ? → $1
    const [users] = await db.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: users
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Contact form
router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // ✅ FIXED: ? → $1, $2, $3, $4, $5
    await db.query(
      'INSERT INTO contacts (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5)',
      [name, email, phone, subject, message]
    );

    // Send email notification
    await sendEmail(
      'support@fairox.co.in',
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

    res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Admin routes
router.get('/admin/stats', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  try {
    const [[pending]] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_approved = 0 AND is_admin = 0');
    const [[approved]] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_approved = 1 AND is_admin = 0');
    const [[total]] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_admin = 0');
    const [[contacts]] = await db.query('SELECT COUNT(*) as count FROM contacts');

    res.json({
      success: true,
      stats: {
        pending: pending.count,
        approved: approved.count,
        total: total.count,
        contacts: contacts.count
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/pending-users', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const [users] = await db.query('SELECT id, name, email, created_at FROM users WHERE is_approved = 0 AND is_admin = 0 ORDER BY created_at DESC');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.get('/admin/approved-users', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const [users] = await db.query('SELECT id, name, email, approved_at FROM users WHERE is_approved = 1 AND is_admin = 0 ORDER BY approved_at DESC');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ✅ APPROVE USER - WITH EMAIL NOTIFICATION
router.post('/admin/approve-user/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    // ✅ FIXED: ? → $1
    const [[user]] = await db.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ FIXED: ? → $1, $2
    await db.query('UPDATE users SET is_approved = 1, approved_by = $1, approved_at = NOW() WHERE id = $2', [req.user.id, req.params.id]);
    
    // Send approval email to user
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
        <p><a href="https://fairox.co.in/login" style="background-color: #2a8f8e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now →</a></p>
        <hr>
        <p>If you have any questions, feel free to contact us at <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <p><em>This is an automated message from Fairox Management System</em><br>© ${new Date().getFullYear()} Fairox. All rights reserved.</p>
      `
    );
    
    res.json({ success: true, message: 'User approved and notified via email' });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ❌ REJECT USER - WITH EMAIL NOTIFICATION
router.delete('/admin/reject-user/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    // ✅ FIXED: ? → $1
    const [[user]] = await db.query('SELECT name, email FROM users WHERE id = $1 AND is_admin = 0', [req.params.id]);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ FIXED: ? → $1
    await db.query('DELETE FROM users WHERE id = $1 AND is_admin = 0', [req.params.id]);
    
    // Send rejection email to user
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
        <p>This decision may be due to various reasons including incomplete information or verification requirements.</p>
        <p>If you believe this is an error or would like to discuss this further, please contact us at: <a href="mailto:support@fairox.co.in">support@fairox.co.in</a></p>
        <hr>
        <p><em>This is an automated message from Fairox Management System</em><br>© ${new Date().getFullYear()} Fairox. All rights reserved.</p>
      `
    );
    
    res.json({ success: true, message: 'User rejected and notified via email' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ⚠️ REVOKE USER - WITH EMAIL NOTIFICATION
router.post('/admin/revoke-user/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    // ✅ FIXED: ? → $1
    const [[user]] = await db.query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ FIXED: ? → $1
    await db.query('UPDATE users SET is_approved = 0, approved_by = NULL, approved_at = NULL WHERE id = $1', [req.params.id]);
    
    // Send revocation email to user
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
        <p><em>This is an automated message from Fairox Management System</em><br>© ${new Date().getFullYear()} Fairox. All rights reserved.</p>
      `
    );
    
    res.json({ success: true, message: 'User access revoked and notified via email' });
  } catch (error) {
    console.error('Revoke user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/contacts', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ success: false });
  }

  try {
    const [contacts] = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// CHANGE PASSWORD - FINAL WORKING VERSION
// ============================================

router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        console.log('🔐 POST /api/auth/change-password - User:', userId);
        
        // ✅ Validate input
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
        
        // ✅ Get current user
        console.log('🔍 Looking up user:', userId);
        // ✅ FIXED: ? → $1
        const query = 'SELECT id, email, password FROM users WHERE id = $1';
        
        let user = null;
        try {
            const [rows] = await db.query(query, [userId]);
            
            console.log('📊 Query returned rows.length:', rows.length);
            console.log('📊 rows type:', typeof rows);
            
            if (!rows || rows.length === 0) {
                console.log('❌ No user found');
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // ✅ FIXED: Get the user data - handle multiple access patterns
            let userData = null;
            
            // Method 1: Try direct field access first (rows.id, rows.email, rows.password)
            if (rows && rows.id !== undefined && rows.email !== undefined && rows.password !== undefined) {
                userData = rows;
                console.log('✅ Using direct field access (rows.id)');
            }
            // Method 2: If Method 1 fails, try rows (nested array)
            else if (rows && rows && rows.id !== undefined && rows.email !== undefined && rows.password !== undefined) {
                userData = rows;
                console.log('✅ Using nested access (rows)');
            }
            // Method 3: Try indexed access (rows, rows, rows)
            else if (rows && rows !== undefined && rows !== undefined && rows !== undefined) {
                userData = {
                    id: rows,
                    email: rows,
                    password: rows
                };
                console.log('✅ Using indexed access (rows, rows, rows)');
            }
            
            console.log('📊 Extracted user:', {
                id: userData ? userData.id : 'N/A',
                email: userData ? userData.email : 'N/A',
                hasPassword: userData ? !!userData.password : false
            });
            
            if (!userData || !userData.id || !userData.email || !userData.password) {
                console.error('❌ Could not extract valid user data');
                console.error('📊 Full rows:', rows);
                if (rows && rows) {
                    console.error('📊 rows:', rows);
                }
                return res.status(500).json({
                    success: false,
                    message: 'Could not extract user data from database'
                });
            }
            
            user = userData;
            console.log('✅ User loaded:', user.email);
            
        } catch (queryError) {
            console.error('❌ Database query error:', queryError.message);
            return res.status(500).json({
                success: false,
                message: 'Error fetching user',
                error: queryError.message
            });
        }
        
        // ✅ Verify current password
        console.log('🔐 Verifying current password...');
        let isPasswordValid = false;
        
        try {
            isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            console.log('✅ Password verification completed');
            console.log('📊 Password matches:', isPasswordValid);
        } catch (bcryptError) {
            console.error('❌ bcrypt.compare error:', bcryptError.message);
            return res.status(500).json({
                success: false,
                message: 'Error verifying password',
                error: bcryptError.message
            });
        }
        
        if (!isPasswordValid) {
            console.log('❌ Current password incorrect');
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        console.log('✅ Current password verified');
        
        // ✅ Hash new password
        console.log('🔐 Hashing new password...');
        let hashedPassword = null;
        
        try {
            hashedPassword = await bcrypt.hash(newPassword, 10);
            console.log('✅ New password hashed successfully');
        } catch (hashError) {
            console.error('❌ bcrypt.hash error:', hashError.message);
            return res.status(500).json({
                success: false,
                message: 'Error hashing password',
                error: hashError.message
            });
        }
        
        if (!hashedPassword) {
            console.error('❌ Hash is empty');
            return res.status(500).json({
                success: false,
                message: 'Error creating password hash'
            });
        }
        
        console.log('✅ New hash created');
        
        // ✅ Update password in database
        console.log('💾 Updating password in database...');
        // ✅ FIXED: ? → $1, $2
        const updateQuery = 'UPDATE users SET password = $1 WHERE id = $2';
        
        try {
            const [updateResult] = await db.query(updateQuery, [hashedPassword, user.id]);
            
            console.log('✅ Update query executed');
            console.log('📊 Rows affected:', updateResult.affectedRows);
            
            if (updateResult.affectedRows === 0) {
                console.error('❌ No rows updated');
                return res.status(500).json({
                    success: false,
                    message: 'Failed to update password'
                });
            }
        } catch (updateError) {
            console.error('❌ Update error:', updateError.message);
            return res.status(500).json({
                success: false,
                message: 'Error updating password',
                error: updateError.message
            });
        }
        
        console.log('✅ Password updated successfully');
        console.log('✅ Password change complete for user:', user.email);
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
});

// ============================================
// LOGOUT
// ============================================

router.get('/logout', authMiddleware, async (req, res) => {
    try {
        console.log('🔐 Logout request - User:', req.user.id);
        
        // ✅ Logout is successful - token is just cleared on frontend
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('❌ Logout error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error during logout',
            error: error.message
        });
    }
});

module.exports = router;
