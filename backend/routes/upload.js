// ============================================
// ✅ COMPLETE UPLOAD.JS - PRODUCTION READY
// File: src/backend/routes/upload.js
// Database: PostgreSQL
// Fixed: Dec 1, 2025
// ============================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

console.log('✅ Upload routes loaded');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Uploads directory created:', uploadsDir);
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/gif',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, PDFs, and Excel files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});


// ============================================
// UPLOAD FILE (POST /api/upload)
// ============================================

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        console.log('📥 POST /api/upload - Uploading file');
        console.log('User ID:', req.user.id);
        console.log('File:', req.file?.originalname);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Save file info to database
        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with RETURNING id and proper rows extraction
        const result = await db.query(
            `INSERT INTO uploads (user_id, filename, original_name, file_path, file_size, mime_type) 
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
                req.user.id,
                req.file.filename,
                req.file.originalname,
                req.file.path,
                req.file.size,
                req.file.mimetype
            ]
        );

        // ✅ FIXED: Extract rows array from result
        const uploadRecord = result.rows[0];

        console.log('✅ File uploaded successfully:', uploadRecord?.id);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                id: uploadRecord?.id || null,
                filename: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('❌ Upload error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
});


// ============================================
// GET USER'S FILES (GET /api/files)
// ============================================

router.get('/files', authMiddleware, async (req, res) => {
    try {
        console.log('📤 GET /api/files - Fetching for user:', req.user.id);

        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with proper rows extraction
        const result = await db.query(
            `SELECT id, original_name, file_size, mime_type, created_at 
             FROM uploads 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        // ✅ FIXED: Extract rows array from result
        const files = result.rows;

        console.log('✅ Found:', files.length, 'files');

        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        console.error('❌ Get files error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve files',
            error: error.message
        });
    }
});


// ============================================
// DELETE FILE (DELETE /api/files/:id)
// ============================================

router.delete('/files/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        console.log('🗑️ DELETE /api/files/:id - Deleting:', id);

        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with proper rows extraction
        const fileResult = await db.query(
            `SELECT file_path FROM uploads 
             WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (fileResult.rows.length === 0) {
            console.log('❌ File not found:', id);
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // ✅ FIXED: Extract first row from array
        const file = fileResult.rows[0];

        // Delete file from filesystem
        if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
            console.log('✅ File deleted from filesystem:', file.file_path);
        }

        // Delete from database
        const deleteResult = await db.query(
            `DELETE FROM uploads WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        // ✅ FIXED: Check rowCount (PostgreSQL)
        if (deleteResult.rowCount === 0) {
            console.log('❌ Failed to delete from database:', id);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete file record'
            });
        }

        console.log('✅ File deleted successfully:', id);

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete file error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to delete file',
            error: error.message
        });
    }
});


// ============================================
// DOWNLOAD FILE (GET /api/download/:id)
// ============================================

router.get('/download/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        console.log('⬇️ GET /api/download/:id - Downloading:', id);

        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with proper rows extraction
        const fileResult = await db.query(
            `SELECT file_path, original_name FROM uploads 
             WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (fileResult.rows.length === 0) {
            console.log('❌ File not found:', id);
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // ✅ FIXED: Extract first row from array
        const file = fileResult.rows[0];

        // ✅ Verify file exists before downloading
        if (!fs.existsSync(file.file_path)) {
            console.log('❌ File not found on filesystem:', file.file_path);
            return res.status(404).json({
                success: false,
                message: 'File not found on filesystem'
            });
        }

        console.log('✅ Downloading file:', file.original_name);

        res.download(file.file_path, file.original_name, (err) => {
            if (err) {
                console.error('❌ Download error:', err.message);
            } else {
                console.log('✅ Download completed:', file.original_name);
            }
        });
    } catch (error) {
        console.error('❌ Download error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to download file',
            error: error.message
        });
    }
});


// ============================================
// GET FILE INFO (GET /api/files/:id)
// ============================================

router.get('/files/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        console.log('📋 GET /api/files/:id - Fetching file info:', id);

        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with proper rows extraction
        const result = await db.query(
            `SELECT id, original_name, file_size, mime_type, created_at, filename 
             FROM uploads 
             WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            console.log('❌ File not found:', id);
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // ✅ FIXED: Extract first row from array
        const file = result.rows[0];

        console.log('✅ File info retrieved:', file.id);

        res.json({
            success: true,
            file: file
        });
    } catch (error) {
        console.error('❌ Get file info error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve file info',
            error: error.message
        });
    }
});


module.exports = router;