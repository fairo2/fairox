// ============================================
// PFMS PROTECTION ROUTE - NEW FILE
// File: routes/pfms-protection.js
// Purpose: Secure PFMS page with JWT authentication
// ============================================

const express = require('express');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');

// ============================================
// MIDDLEWARE: Verify PFMS Access
// ============================================

const verifyPFMSAccess = (req, res, next) => {
    try {
        // Get token from multiple sources
        const token = 
            req.headers.authorization?.split(' ')[1] ||  // Bearer token from headers
            req.cookies?.authToken ||                      // From cookies
            req.query.token;                               // From URL parameter

        console.log('\n' + '='.repeat(60));
        console.log('🔐 PFMS ACCESS VERIFICATION');
        console.log('='.repeat(60));
        console.log('Requested URL:', req.originalUrl);
        console.log('Token found:', token ? '✅ YES' : '❌ NO');

        if (!token) {
            console.log('❌ RESULT: Access Denied - No token');
            console.log('Redirecting to: /admin.html?redirect=pfms');
            console.log('='.repeat(60) + '\n');
            
            return res.redirect('/admin.html?redirect=pfms&error=no_token');
        }

        // Verify JWT token
        console.log('Verifying JWT token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('✅ Token Valid');
        console.log('User ID:', decoded.id);
        console.log('User Email:', decoded.email);
        console.log('Is Admin:', decoded.is_admin);
        console.log('='.repeat(60) + '\n');

        // Store token and user data in request
        req.userToken = token;
        req.userData = decoded;
        
        next();
        
    } catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('🔐 PFMS ACCESS VERIFICATION - FAILED');
        console.log('='.repeat(60));
        console.log('Error Type:', error.name);
        console.log('Error Message:', error.message);
        console.log('❌ RESULT: Access Denied');
        console.log('Redirecting to: /admin.html');
        console.log('='.repeat(60) + '\n');
        
        // Redirect to admin login on any auth failure
        res.redirect('/admin.html?error=invalid_token&redirect=pfms');
    }
};

// ============================================
// ROUTE 1: GET /pfms - Serve PFMS Page
// ============================================

router.get('/pfms', verifyPFMSAccess, (req, res) => {
    const filePath = path.join(__dirname, '../public/pfms.html');
    
    console.log('✅ PFMS PAGE SERVE - ACCESS GRANTED');
    console.log('User ID:', req.userData.id);
    console.log('Serving file:', filePath);
    console.log('');
    
    // Set response headers with user info
    res.set('X-Auth-Token', req.userToken);
    res.set('X-User-ID', req.userData.id);
    res.set('X-User-Email', req.userData.email);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Send the file
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('❌ Error serving pfms.html:', err.message);
            res.status(404).json({
                success: false,
                message: 'PFMS page not found',
                error: err.message
            });
        }
    });
});

// ============================================
// ROUTE 2: POST /pfms/access - Verify Access
// ============================================

router.post('/pfms/access', verifyPFMSAccess, (req, res) => {
    console.log('✅ PFMS ACCESS VERIFICATION - POST REQUEST');
    console.log('User ID:', req.userData.id);
    console.log('Returning access grant\n');
    
    res.json({
        success: true,
        message: 'PFMS access granted',
        user: {
            id: req.userData.id,
            email: req.userData.email,
            is_admin: req.userData.is_admin,
            name: req.userData.name
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ROUTE 3: GET /pfms/health - Check PFMS Status
// ============================================

router.get('/pfms/health', verifyPFMSAccess, (req, res) => {
    console.log('✅ PFMS HEALTH CHECK - AUTHORIZED USER');
    console.log('User ID:', req.userData.id);
    
    res.json({
        success: true,
        message: 'PFMS is healthy',
        page: '/pfms',
        status: 'online',
        user_authenticated: true,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ROUTE 4: Catch-all for undefined /pfms/* routes
// ============================================

router.all('/pfms*', verifyPFMSAccess, (req, res) => {
    console.log('⚠️ PFMS Request - Route not found:', req.path);
    
    res.status(404).json({
        success: false,
        message: 'PFMS resource not found',
        path: req.path,
        method: req.method
    });
});

module.exports = router;