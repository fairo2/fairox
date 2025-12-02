// ============================================
// ✅ ENHANCED AUTH MIDDLEWARE - SECURITY FEATURES
// File: middleware/authEnhanced.js
// Features: Session timeout, Activity tracking, CSRF, Rate limiting
// Updated: Dec 2, 2025
// ============================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Store active sessions in memory (in production, use Redis)
const activeSessions = new Map();
const rateLimitMap = new Map();

// ============================================
// INACTIVITY TIMEOUT CONFIGURATION
// ============================================

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_TIME = 9 * 60 * 1000;        // 9 minutes - show warning
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;  // 15 minutes

// ============================================
// CREATE SESSION ID
// ============================================

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// ACTIVITY TRACKING MIDDLEWARE
// ============================================

const activityTracker = (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    if (userId && sessionId) {
      const sessionKey = `${userId}_${sessionId}`;

      // Update last activity time
      if (activeSessions.has(sessionKey)) {
        activeSessions.set(sessionKey, {
          ...activeSessions.get(sessionKey),
          lastActivity: Date.now()
        });
      }

      // Log request metadata
      console.log(`[ACTIVITY] User: ${userId} | Route: ${req.path} | Method: ${req.method} | IP: ${req.ip}`);
    }

    next();
  } catch (error) {
    console.error('Activity tracking error:', error.message);
    next();
  }
};

// ============================================
// ENHANCED AUTH MIDDLEWARE WITH SESSION TIMEOUT
// ============================================

const authMiddlewareEnhanced = (req, res, next) => {
  try {
    // ✅ Step 1: Verify JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('❌ FATAL: JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // ✅ Step 2: Get authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // ✅ Step 3: Extract token
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('❌ Invalid authorization format');
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use: Bearer {token}'
      });
    }

    const token = parts[1];

    if (typeof token !== 'string' || !token) {
      console.log('❌ Invalid token format');
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // ✅ Step 4: Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Step 5: Extract user ID
    const userId = decoded.id || decoded.userId;

    if (!userId) {
      console.log('❌ No user ID in token');
      return res.status(401).json({
        success: false,
        message: 'Invalid token: User ID not found'
      });
    }

    // ✅ Step 6: Check session timeout
    const sessionId = req.headers['x-session-id'];

    if (sessionId) {
      const sessionKey = `${userId}_${sessionId}`;
      const session = activeSessions.get(sessionKey);

      if (session) {
        const timeSinceLastActivity = Date.now() - session.lastActivity;

        // ⚠️ Warning: Send warning signal at 9 minutes
        if (timeSinceLastActivity > WARNING_TIME && timeSinceLastActivity < INACTIVITY_TIMEOUT) {
          res.set('X-Session-Warning', 'EXPIRING_SOON');
          console.log(`[WARNING] Session expiring soon for user ${userId}`);
        }

        // ❌ Timeout: Logout at 10 minutes
        if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
          activeSessions.delete(sessionKey);
          console.log(`[LOGOUT] Session timeout for user ${userId}`);
          return res.status(401).json({
            success: false,
            message: 'Session expired due to inactivity. Please login again.',
            sessionExpired: true
          });
        }

        // ✅ Update last activity
        activeSessions.set(sessionKey, {
          ...session,
          lastActivity: Date.now()
        });
      }
    }

    // ✅ Step 7: Attach user data to request
    req.user = decoded;
    req.user.id = userId;
    req.userId = userId;

    console.log(`✅ Auth successful for user: ${userId}`);

    next();

  } catch (error) {
    console.error('❌ Auth error:', error.name, '-', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// ============================================
// ADMIN MIDDLEWARE WITH SECURITY CHECKS
// ============================================

const adminMiddlewareEnhanced = (req, res, next) => {
  try {
    // ✅ Check authentication
    if (!req.user) {
      console.log('❌ Admin check: User not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // ✅ Check admin privileges
    if (!req.user.is_admin) {
      console.error(`❌ SECURITY: Non-admin user ${req.user.id} attempted admin access to ${req.path}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // ✅ Rate limiting for admin routes
    const rateLimitKey = `admin_${req.user.id}_${req.ip}`;
    const now = Date.now();

    if (!rateLimitMap.has(rateLimitKey)) {
      rateLimitMap.set(rateLimitKey, {
        attempts: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      });
    } else {
      const record = rateLimitMap.get(rateLimitKey);

      // Reset if window expired
      if (now > record.resetTime) {
        rateLimitMap.set(rateLimitKey, {
          attempts: 1,
          resetTime: now + RATE_LIMIT_WINDOW
        });
      } else {
        // Increment attempts
        record.attempts++;

        if (record.attempts > RATE_LIMIT_ATTEMPTS) {
          console.error(`❌ SECURITY: Rate limit exceeded for admin ${req.user.id}`);
          return res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.'
          });
        }

        rateLimitMap.set(rateLimitKey, record);
      }
    }

    console.log(`✅ Admin access granted to ${req.user.email} for ${req.path}`);

    next();

  } catch (error) {
    console.error('❌ Admin middleware error:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
};

// ============================================
// SESSION CREATION (Called after login)
// ============================================

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

// ============================================
// SESSION TERMINATION
// ============================================

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

// ============================================
// GET SESSION REMAINING TIME
// ============================================

function getSessionRemainingTime(userId, sessionId) {
  const sessionKey = `${userId}_${sessionId}`;
  const session = activeSessions.get(sessionKey);

  if (!session) return 0;

  const timeSinceLastActivity = Date.now() - session.lastActivity;
  const remaining = Math.max(0, INACTIVITY_TIMEOUT - timeSinceLastActivity);

  return Math.ceil(remaining / 1000); // Return in seconds
}

// ============================================
// SECURITY HEADERS MIDDLEWARE
// ============================================

const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.set('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");

  // Referrer Policy
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
};

// ============================================
// CSRF TOKEN GENERATION
// ============================================

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

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
}, 60000); // Check every minute

module.exports = {
  authMiddlewareEnhanced,
  adminMiddlewareEnhanced,
  activityTracker,
  securityHeaders,
  createSession,
  terminateSession,
  getSessionRemainingTime,
  generateCSRFToken,
  activeSessions
};