// ============================================
// UPDATED SERVER.JS - with /logout endpoint
// ============================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const uploadRoutes = require('./routes/upload');
const pfmsRoutes = require('./routes/pfms-routes');
const recurringRoutes = require('./routes/recurringTransactions');
const budgetRoutes = require('./routes/budget');
const exportRouter = require('./routes/export');
const overviewRouter = require('./routes/overview');

dotenv.config();

// 🐛 DEBUG - Add these lines to check if .env is loading
console.log('=====================================');
console.log('📧 EMAIL CONFIGURATION CHECK:');
console.log('=====================================');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***PASSWORD SET***' : '❌ NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('=====================================\n');

const authRoutes = require('./routes/auth');
const db = require('./config/db');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

// This middleware extracts and verifies JWT token for protected routes
const attachUserFromToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
            req.user = decoded;
        } catch (error) {
            // Token invalid, but we don't reject yet
            // Routes can decide if they need auth
            console.log('Token verification failed:', error.message);
        }
    }
    next();
};

// Apply auth middleware to all requests
app.use(attachUserFromToken);

// ============================================
// STATIC FILES SERVING
// ============================================

// ✅ Serve static files from parent public folder
app.use(express.static(path.join(__dirname, '../public')));

// ✅ Explicit routes for HTML files to prevent redirect issues
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/pfms.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pfms.html'));
});

// Root redirect
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// API ROUTES
// ============================================

// Authentication routes
app.use('/api/auth', authRoutes);

// File upload routes
app.use('/api/upload', uploadRoutes);

// Personal Finance Management System routes
app.use('/api/pfms', pfmsRoutes);

// Register routes
app.use('/api/recurring', recurringRoutes);
app.use('/api/budget', budgetRoutes);

app.use('/api/export', exportRouter);
app.use('/api/overview', overviewRouter);

// ============================================
// LOGOUT - Direct /logout endpoint
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
            message: 'Error during logout',
            error: error.message
        });
    }
});

// Auto-generate recurring transactions (run every day at midnight)
const cron = require('node-cron');
cron.schedule('0 0 * * *', () => {
    console.log('Auto-generating recurring transactions...');
    fetch('https://fairox-backend.onrender.com/api/recurring/process/auto-generate', { method: 'POST' });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// DATABASE CONNECTION CHECK (ASYNC VERSION)
// ============================================

app.get('/api/db-check', async (req, res) => {
    try {
        // Using async/await for promise-based MySQL2 pool
        const connection = await db.getConnection();
        const [result] = await connection.query('SELECT 1');
        connection.release();
        
        res.json({
            success: true,
            message: 'Database connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database check error:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// ============================================
// 404 ERROR HANDLER
// ============================================

app.use((req, res) => {
    // If requesting .html file, return the file instead of 404
    if (req.path.endsWith('.html')) {
        const filePath = path.join(__dirname, '../public', req.path);
        res.sendFile(filePath, (err) => {
            if (err) {
                res.status(404).json({
                    success: false,
                    message: 'File not found',
                    path: req.path
                });
            }
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Route not found',
            path: req.path,
            method: req.method
        });
    }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

app.use((err, req, res, next) => {
    console.error('🔴 Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, async () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🚀 FAIROX BACKEND SERVER              ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  ✅ Server running on port ${PORT.toString().padEnd(26)}║`);
    console.log(`║  📡 API URL: http://${HOST}:${PORT}/api${' '.repeat(18)}║`);
    console.log(`║  🏥 Health: http://${HOST}:${PORT}/api/health${' '.repeat(12)}║`);
    console.log('║  📄 Static files: public/                ║');
    console.log('║  ─────────────────────────────────────── ║');
    console.log('║  Routes:                                  ║');
    console.log('║  • http://localhost:5000/index.html      ║');
    console.log('║  • http://localhost:5000/admin.html      ║');
    console.log('║  • http://localhost:5000/pfms.html       ║');
    console.log('║  • http://localhost:5000/dashboard.html  ║');
    console.log('║  • http://localhost:5000/logout          ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Test database connection using async/await
    try {
        const connection = await db.getConnection();
        const [result] = await connection.query('SELECT 1');
        connection.release();
        console.log('✅ Database connected successfully\n');
    } catch (error) {
        console.log('⚠️  Database connection error:', error.message);
        console.log('   Please check your MySQL configuration\n');
    }
});

// Handle server errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔴 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;