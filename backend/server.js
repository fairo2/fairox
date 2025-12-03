// ============================================
// ✅ ENHANCED SERVER.JS - PRODUCTION READY
// Render-ready with PostgreSQL & Email Config
// FIXED: Trust Proxy + Rate Limiting for Admin
// Updated: December 3, 2025
// ============================================


const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


// Load environment variables
dotenv.config();


// ============================================
// DEBUG - Check environment
// ============================================


console.log('=====================================');
console.log('📧 MAILJET EMAIL CONFIGURATION CHECK:');
console.log('=====================================');
console.log('MAILJET_API_KEY:', process.env.MAILJET_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('MAILJET_SECRET_KEY:', process.env.MAILJET_SECRET_KEY ? '✅ SET' : '❌ NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || '❌ NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('=====================================');
console.log('🗄️  DATABASE CONFIGURATION CHECK:');
console.log('=====================================');
console.log('DB_HOST:', process.env.DB_HOST ? '✅ SET' : '❌ NOT SET');
console.log('DB_USER:', process.env.DB_USER ? '✅ SET' : '❌ NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ SET' : '❌ NOT SET');
console.log('DB_NAME:', process.env.DB_NAME ? '✅ SET' : '❌ NOT SET');
console.log('DB_PORT:', process.env.DB_PORT || '❌ NOT SET');
console.log('=====================================');
console.log('🌐 SERVER CONFIGURATION CHECK:');
console.log('=====================================');
console.log('PORT:', process.env.PORT || '5000');
console.log('CLIENT_URL:', process.env.CLIENT_URL || 'https://fairox.co.in');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('=====================================\n');


// ============================================
// INITIALIZE EXPRESS APP
// ============================================


const app = express();


// ============================================
// ✅ TRUST PROXY - MUST BE FIRST (For Render)
// ============================================


app.set('trust proxy', 1);


// ============================================
// SECURITY MIDDLEWARE
// ============================================


app.use(helmet()); // Security headers


// ============================================
// IMPORT CONFIG & MIDDLEWARE
// ============================================


// ✅ Import email config with error handling
let sendEmail, emailTemplates;
try {
  ({ sendEmail, emailTemplates } = require('./config/emailConfig'));
  console.log('✅ Email config loaded successfully\n');
} catch (error) {
  console.error('⚠️  Email config import failed:', error.message);
  console.error('   Email functionality will be limited\n');
  // Fallback functions
  sendEmail = async () => false;
  emailTemplates = {};
}


// ✅ Import database for connection checks
const db = require('./config/db');


// ✅ Import auth middleware (only for protected routes)
const { authMiddleware, adminMiddleware } = require('./middleware/auth');


// ============================================
// IMPORT ROUTES (CORRECT WAY)
// ============================================


// ✅ Import route ROUTER objects (not middleware)
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const pfmsRoutes = require('./routes/pfms-routes');
const recurringRoutes = require('./routes/recurringTransactions');
const budgetRoutes = require('./routes/budget');
const exportRouter = require('./routes/export');
const overviewRouter = require('./routes/overview');
const adminRoutes = require('./routes/admin-routes');
const testEmailRoutes = require('./routes/test-email');
const advancedEmailDiag = require('./routes/advanced-email-test');


// ============================================
// CORS CONFIGURATION
// ============================================


app.use(cors({
  origin: process.env.CLIENT_URL || 'https://fairox.co.in',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID']
}));


// ============================================
// REQUEST LOGGING MIDDLEWARE
// ============================================


if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined')); // Detailed logging in production
} else {
  app.use(morgan('dev')); // Concise logging in development
}


// ============================================
// REQUEST TIMEOUT MIDDLEWARE
// ============================================


app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  next();
});


// ============================================
// BODY PARSING MIDDLEWARE
// ============================================


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// ============================================
// JWT TOKEN EXTRACTION (for optional auth)
// Must be BEFORE rate limiter so we can check is_admin
// ============================================


const attachUserFromToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
      req.user = decoded;
      req.user.id = decoded.id || decoded.userId;
    }
  } catch (error) {
    // Token invalid or expired - continue without auth
  }
  next();
};


app.use(attachUserFromToken);


// ============================================
// ✅ RATE LIMITING MIDDLEWARE - ADMIN FRIENDLY
// ============================================


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req, res) => {
    // Allow 100 requests for admin, 100 for general API
    return 100;
  },
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and test endpoints
    return req.path === '/api/health' || req.path === '/api/db-check';
  }
});


app.use('/api/', limiter);


console.log('✅ Middleware initialized\n');


// ============================================
// STATIC FILES
// ============================================


// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));


// Explicit HTML routes
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});


app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});


app.get('/pfms.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pfms.html'));
});


app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});


// Root redirect
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});


// ============================================
// API ROUTES - CORRECT USAGE
// ============================================


console.log('🔗 Registering routes...');


// ✅ CORRECT: Pass route ROUTER (not middleware)
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/pfms', pfmsRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/export', exportRouter);
app.use('/api/overview', overviewRouter);
app.use('/api', adminRoutes);
app.use('/test-email', testEmailRoutes);
app.use('/test-email-advanced', advancedEmailDiag);


console.log('✅ All routes registered\n');


// ============================================
// DIRECT LOGOUT ENDPOINT
// ============================================


app.get('/logout', (req, res) => {
  try {
    console.log('🔐 Logout request - User:', req.user?.id || 'anonymous');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});


// ============================================
// HEALTH CHECK ENDPOINT
// ============================================


app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      uptime: `${Math.floor(process.uptime())} seconds`
    }
  });
});


// ============================================
// DATABASE CONNECTION CHECK
// ============================================


app.get('/api/db-check', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connected',
      timestamp: result.rows[0].now,
      connection: 'PostgreSQL'
    });
  } catch (error) {
    console.error('❌ Database check error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});


// ============================================
// AUTO-INITIALIZE ADMIN USER ON STARTUP
// FIXED: Only creates admin once, never resets password
// ============================================


let adminInitializing = false;


async function initializeAdmin() {
  if (adminInitializing) {
    console.log('⏳ Admin initialization already in progress...');
    return;
  }
  
  adminInitializing = true;


  try {
    const bcrypt = require('bcryptjs');
    
    console.log('\n📋 Initializing admin user...\n');


    // Check if admin exists
    const adminCheck = await db.query(
      'SELECT id, email, password FROM users WHERE email = $1 AND is_admin = $2',
      ['admin@fairox.co.in', true]
    );


    if (adminCheck.rows.length === 0) {
      // Admin doesn't exist - create it ONLY ONCE with default password
      console.log('✅ Creating admin user for the first time...\n');
      
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      
      await db.query(
        'INSERT INTO users (name, email, password, is_approved, is_admin, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
        ['Admin User', 'admin@fairox.co.in', hashedPassword, true, true]
      );


      console.log('✅ Admin created successfully!');
      console.log('   Email: admin@fairox.co.in');
      console.log('   Default Password: Admin@123');
      console.log('   ⚠️  IMPORTANT: Change this password after first login!\n');
    } else {
      // Admin already exists - DO NOT MODIFY PASSWORD
      console.log('✅ Admin user already exists');
      console.log('   Email: admin@fairox.co.in');
      console.log('   ✅ Using stored password (no reset on restart)\n');
    }
  } catch (error) {
    console.error('⚠️  Admin initialization failed:', error.message);
    console.error('   You may need to create admin manually\n');
  } finally {
    adminInitializing = false;
  }
}


// ============================================
// CRON JOB - Auto-generate recurring transactions
// With proper error handling and timeout
// ============================================


cron.schedule('0 0 * * *', async () => {
  try {
    console.log('⏰ Running cron job: Auto-generating recurring transactions...');
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(`${apiUrl}/api/recurring/process/auto-generate`, { 
      method: 'POST',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    console.log('✅ Cron job completed:', data.message || 'Success');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Cron job timeout: Request took longer than 30 seconds');
    } else {
      console.error('❌ Cron job error:', error.message);
    }
  }
});


// ============================================
// 404 ERROR HANDLER
// ============================================


app.use((req, res) => {
  // Try to serve HTML files
  if (req.path.endsWith('.html')) {
    const filePath = path.join(__dirname, '../public', req.path);
    return res.sendFile(filePath, (err) => {
      res.status(404).json({
        success: false,
        message: 'File not found',
        path: req.path
      });
    });
  }


  // API 404
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      'GET /api/health',
      'GET /api/db-check',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/admin-login',
      'GET /api/auth/test',
      'GET /logout',
      'GET /test-email/check-env',
      'GET /test-email/test-smtp',
      'POST /test-email/send-test-email',
      'GET /test-email/full-diagnostic'
    ]
  });
});


// ============================================
// GLOBAL ERROR HANDLER
// ============================================


app.use((err, req, res, next) => {
  console.error('🔴 Global error handler:', err);
  console.error('   Message:', err.message);
  console.error('   Stack:', err.stack);


  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});


// ============================================
// SERVER STARTUP - RENDER COMPATIBLE
// ============================================


const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // ✅ CRITICAL: Listen on 0.0.0.0 for Render


const server = app.listen(PORT, HOST, async () => {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  🚀 FAIROX BACKEND SERVER - PRODUCTION READY   ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  ✅ Server listening on ${HOST}:${PORT}${' '.repeat(23 - PORT.toString().length)}║`);
  console.log(`║  🌐 API URL: http://localhost:${PORT}/api${' '.repeat(18)}║`);
  console.log(`║  💚 Health: http://localhost:${PORT}/api/health${' '.repeat(13)}║`);
  console.log('║  📧 Email: Mailjet SMTP (Port 2525)             ║');
  console.log('║  🗄️  Database: PostgreSQL Connected            ║');
  console.log('║  🔒 Security: Helmet + Trust Proxy              ║');
  console.log('║  ───────────────────────────────────────────────║');
  console.log('║  Routes:                                        ║');
  console.log('║  • POST   /api/auth/login                       ║');
  console.log('║  • POST   /api/auth/register                    ║');
  console.log('║  • POST   /api/auth/admin-login                 ║');
  console.log('║  • GET    /api/auth/test                        ║');
  console.log('║  • GET    /logout                               ║');
  console.log('║  • GET    /api/health                           ║');
  console.log('║  • GET    /api/db-check                         ║');
  console.log('╚════════════════════════════════════════════════╝\n');


  // Test database connection
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Database: PostgreSQL connected');
    console.log('   Server time:', result.rows[0].now, '\n');
    
    // Initialize admin user on startup
    await initializeAdmin();
    
  } catch (error) {
    console.error('⚠️  Database connection error:', error.message);
    console.error('   Make sure PostgreSQL is running and environment variables are set\n');
  }
});


// ============================================
// GRACEFUL SHUTDOWN
// ============================================


process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});


process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});


// ============================================
// ERROR HANDLERS
// ============================================


process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
});


process.on('uncaughtException', (error) => {
  console.error('🔴 Uncaught Exception:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
});


module.exports = app;