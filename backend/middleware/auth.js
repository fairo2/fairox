const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // ✅ NEW: Verify JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('❌ FATAL: JWT_SECRET not configured in .env');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }

        const token = req.headers.authorization?.split(' ');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        // ✅ Verify token with proper error handling
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ✅ Extract userId from token
        const userId = decoded.id || decoded.userId || decoded.user_id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token: User ID not found' 
            });
        }
        
        // ✅ Set both req.user.id AND req.userId
        req.user = decoded;
        req.user.id = userId;
        req.userId = userId;
        
        if (decoded.is_admin) {
            req.user.is_admin = true;
        }
        
        console.log('✅ Auth successful - User ID:', userId, 'Admin:', !!decoded.is_admin);
        
        next();
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        
        // ✅ NEW: Distinguish between token errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired. Please login again.' 
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token.' 
            });
        }
        
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication failed.' 
        });
    }
};

const adminMiddleware = (req, res, next) => {
    // ✅ IMPROVED: Better error checking
    if (!req.user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required.' 
        });
    }

    if (!req.user.is_admin) {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Admin privileges required.' 
        });
    }
    
    console.log('✅ Admin access granted to user:', req.user.id);
    next();
};

module.exports = { authMiddleware, adminMiddleware };
