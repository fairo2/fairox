const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
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

// Upload file
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Save file info to database
        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with RETURNING id
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

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                id: result.rows.id,
                filename: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file'
        });
    }
});

// Get user's files
router.get('/files', authMiddleware, async (req, res) => {
    try {
        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax with $1 parameter
        const result = await db.query(
            `SELECT id, original_name, file_size, mime_type, created_at 
             FROM uploads 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            files: result.rows
        });
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve files'
        });
    }
});

// Delete file
router.delete('/files/:id', authMiddleware, async (req, res) => {
    try {
        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax - no double destructuring
        const fileResult = await db.query(
            `SELECT file_path FROM uploads 
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const file = fileResult.rows;

        // Delete file from filesystem
        if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
        }

        // Delete from database
        await db.query(
            `DELETE FROM uploads WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete file'
        });
    }
});

// Download file
router.get('/download/:id', authMiddleware, async (req, res) => {
    try {
        const db = require('../config/db');
        
        // ✅ FIXED: PostgreSQL syntax
        const fileResult = await db.query(
            `SELECT file_path, original_name FROM uploads 
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const file = fileResult.rows;
        res.download(file.file_path, file.original_name);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download file'
        });
    }
});

module.exports = router;