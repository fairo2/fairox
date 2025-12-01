const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// ✅ Auth Middleware
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
        });
    }
};

// ✅ Change Admin Password Endpoint
router.post('/admin/change-password', authMiddleware, async (req, res) => {
    try {
        const adminId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        console.log(`🔐 Change password request for admin: ${adminId}`);

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters'
            });
        }

        // Get admin from database
        const result = await db.query(
            'SELECT id, password FROM admin_users WHERE id = $1',
            [adminId]
        );

        if (result.rows.length === 0) {
            console.error(`❌ Admin user not found: ${adminId}`);
            return res.status(404).json({
                success: false,
                message: 'Admin user not found'
            });
        }

        const admin = result.rows;

        // Verify current password using bcrypt
        const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
        
        if (!isPasswordValid) {
            console.log(`❌ Current password incorrect for admin: ${adminId}`);
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in database
        await db.query(
            'UPDATE admin_users SET password = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, adminId]
        );

        console.log(`✅ Password changed successfully for admin: ${adminId}`);
        
        res.json({
            success: true,
            message: '✅ Password changed successfully'
        });

    } catch (error) {
        console.error('❌ Error changing password:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
