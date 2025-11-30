const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ✅ CRITICAL: Extract userId from token
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
        
        console.log('✅ Auth successful - User ID:', userId);
        
        next();
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Admin only.' 
        });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware };
