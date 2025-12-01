// ============================================
// ✅ FIXED auth.js - CORRECTED VERSION
// ============================================

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // ✅ Step 1: Verify JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('❌ FATAL: JWT_SECRET not configured in .env');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error: JWT_SECRET not set'
            });
        }

        console.log('🔐 Auth middleware - checking token...');

        // ✅ Step 2: Get authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            console.log('❌ No authorization header');
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        console.log('   Authorization header present: ✅');

        // ✅ Step 3: Split into [Bearer, token] and validate format
        const parts = authHeader.split(' ');
        
        if (parts.length !== 2) {
            console.log('❌ Invalid header format - not 2 parts');
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid authorization format.' 
            });
        }

        if (parts[0] !== 'Bearer') {
            console.log('❌ Missing "Bearer" prefix');
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid authorization format. Use: Bearer {token}' 
            });
        }

        // ✅ Step 4: Extract token STRING (not array!)
        const token = parts[1];
        
        if (!token) {
            console.log('❌ Token is empty');
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. Token is empty.' 
            });
        }

        console.log('   Token extracted: ✅', token.substring(0, 30) + '...');
        console.log('   Token type:', typeof token, '✅ STRING');

        // ✅ Step 5: Verify token is a STRING (this fixes the "jwt must be a string" error!)
        if (typeof token !== 'string') {
            console.error('❌ CRITICAL: Token is not a string!', typeof token);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token format.' 
            });
        }

        console.log('   JWT_SECRET configured: ✅');

        // ✅ Step 6: Verify JWT signature
        console.log('   Verifying JWT...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('   ✅ JWT verified successfully');
        
        // ✅ Step 7: Extract userId from token
        const userId = decoded.id || decoded.userId || decoded.user_id;
        
        if (!userId) {
            console.log('❌ No user ID in token');
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token: User ID not found' 
            });
        }
        
        console.log('   User ID:', userId);
        console.log('   is_admin:', !!decoded.is_admin);

        // ✅ Step 8: Attach user data to request
        req.user = decoded;
        req.user.id = userId;
        req.userId = userId;
        
        if (decoded.is_admin) {
            req.user.is_admin = true;
        }
        
        console.log('✅ Auth successful!\n');
        
        next();

    } catch (error) {
        console.error('❌ Auth error:', error.name, '-', error.message);
        
        // ✅ Distinguish between different JWT errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired. Please login again.' 
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token: ' + error.message
            });
        } else if (error.name === 'NotBeforeError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token not yet valid.' 
            });
        }
        
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication failed: ' + error.message
        });
    }
};

const adminMiddleware = (req, res, next) => {
    // ✅ Check if user is authenticated
    if (!req.user) {
        console.log('❌ Admin check: User not authenticated');
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required.' 
        });
    }

    console.log('👤 Admin check - User ID:', req.user.id);

    // ✅ Check if user is admin
    if (!req.user.is_admin) {
        console.log('❌ Admin check: User is not admin');
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Admin privileges required.' 
        });
    }
    
    console.log('✅ Admin access granted\n');
    next();
};

module.exports = { authMiddleware, adminMiddleware };