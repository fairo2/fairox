// ============================================
// ✅ COMPLETE PFMS-ROUTES.JS - FULLY FIXED
// File: src/backend/routes/pfms-routes.js
// Database: PostgreSQL
// Updated: Dec 3, 2025 - Duplicate Middleware REMOVED
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

// ✅ IMPORT auth middleware from shared location
const { authMiddleware } = require('../middleware/auth');

console.log('✅ PFMS routes loaded');


// ============================================
// ✅ PUBLIC ROUTES (NO AUTHENTICATION)
// ============================================

// Generate sample Excel template for download
router.get('/transactions/template', (req, res) => {
    try {
        const sampleData = [
            {
                account_name: 'HDFC',
                category_name: 'Salary',
                mode: 'Income',
                currency: 'INR',
                amount: 50000,
                transaction_date: '2025-11-29',
                description: 'Monthly salary'
            },
            {
                account_name: 'Cash',
                category_name: 'Groceries',
                mode: 'Expense',
                currency: 'INR',
                amount: 5000,
                transaction_date: '2025-11-29',
                description: 'Weekly shopping'
            },
            {
                account_name: 'Alrajhi',
                category_name: 'Rent',
                mode: 'Expense',
                currency: 'SAR',
                amount: 2000,
                transaction_date: '2025-11-29',
                description: 'Monthly rent'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [
            { wch: 18 },
            { wch: 18 },
            { wch: 15 },
            { wch: 12 },
            { wch: 12 },
            { wch: 15 },
            { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="pfms-template.xlsx"');
        
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.send(buf);
    } catch (error) {
        console.error('❌ Template generation error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ============================================
// 🔒 AUTH MIDDLEWARE (Applied to all routes below)
// ============================================

// ✅ Apply middleware to all protected routes
router.use(authMiddleware);


// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.mimetype === 'text/csv') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files allowed'));
        }
    }
});


// ============================================
// ✅ PROTECTED ROUTES (WITH AUTHENTICATION)
// ============================================


// TRANSACTIONS ENDPOINTS

router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'transaction_date', 
            sortOrder = 'DESC',
            currency,
            mode,
            from_date,
            to_date,
            search
        } = req.query;

        const allowedSortColumns = ['transaction_date', 'amount', 'mode', 'currency'];
        const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'transaction_date';
        const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let query = `
            SELECT t.*, a.name as account_name, c.name as category_name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = $1
        `;
        
        let paramIndex = 2;
        const params = [userId];

        if (currency) {
            query += ` AND t.currency = $${paramIndex}`;
            params.push(currency);
            paramIndex++;
        }
        if (mode) {
            query += ` AND t.mode = $${paramIndex}`;
            params.push(mode);
            paramIndex++;
        }
        if (from_date) {
            query += ` AND t.transaction_date >= $${paramIndex}`;
            params.push(from_date);
            paramIndex++;
        }
        if (to_date) {
            query += ` AND t.transaction_date <= $${paramIndex}`;
            params.push(to_date);
            paramIndex++;
        }
        if (search) {
            const searchTerm = `%${search}%`;
            query += ` AND (t.description ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex + 1} OR c.name ILIKE $${paramIndex + 2})`;
            params.push(searchTerm, searchTerm, searchTerm);
            paramIndex += 3;
        }

        // Get count
        const countQuery = query.replace('SELECT t.*, a.name as account_name, c.name as category_name', 'SELECT COUNT(*) as total');
        const countResult = await db.query(countQuery, params);
        
        const countRow = countResult.rows[0];
        const total = parseInt(countRow.total);
        const pages = Math.ceil(total / limit);

        // Add sorting and pagination
        query += ` ORDER BY t.${sortColumn} ${sortDir}`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const result = await db.query(query, params);
        const transactions = result.rows;

        res.json({
            success: true,
            transactions: transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages
            }
        });
    } catch (error) {
        console.error('❌ Error fetching transactions:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency, account_id, mode, category_id, transaction_date, description, amount } = req.body;

        if (!currency || !account_id || !mode || !category_id || !transaction_date || !amount) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Amount must be > 0' });
        }

        // Verify account ownership
        const accountCheck = await db.query(
            'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
            [account_id, userId]
        );

        if (accountCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Account not found' });
        }

        const result = await db.query(
            `INSERT INTO transactions (user_id, currency, account_id, mode, category_id, transaction_date, description, amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [userId, currency, account_id, mode, category_id, transaction_date, description, parsedAmount]
        );

        const transaction = result.rows[0];

        res.json({
            success: true,
            message: 'Transaction created successfully',
            id: transaction?.id || null
        });
    } catch (error) {
        console.error('❌ Error creating transaction:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/transactions/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { currency, account_id, mode, category_id, transaction_date, description, amount } = req.body;

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Amount must be valid' });
        }

        // Verify transaction ownership
        const transactionCheck = await db.query(
            'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (transactionCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Transaction not found' });
        }

        await db.query(
            `UPDATE transactions 
             SET currency = $1, account_id = $2, mode = $3, category_id = $4, transaction_date = $5, description = $6, amount = $7
             WHERE id = $8 AND user_id = $9`,
            [currency, account_id, mode, category_id, transaction_date, description, parsedAmount, id, userId]
        );

        res.json({ success: true, message: 'Transaction updated successfully' });
    } catch (error) {
        console.error('❌ Error updating transaction:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/transactions/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ success: false, message: 'Transaction not found' });
        }

        res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting transaction:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// IMPORT ENDPOINTS

router.post('/transactions/import-preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (!data || data.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        const columns = Object.keys(data[0] || {});
        const preview = data.slice(0, 10);

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            totalRows: data.length,
            preview,
            columns,
            message: 'Preview loaded successfully'
        });
    } catch (error) {
        console.error('❌ Preview error:', error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ✅ FULLY UPDATED: Import endpoint with better date parsing
router.post('/transactions/import', upload.single('file'), async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: true });

        if (!data || data.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        // ✅ IMPROVED: Better date parsing with multiple formats support
        const parseExcelDate = (value) => {
            if (!value) return null;

            // Handle Excel numeric dates
            if (typeof value === 'number') {
                const date = new Date(Math.round((value - 25569) * 86400 * 1000));
                return date.toISOString().split('T')[0];
            }

            const strVal = String(value).trim();

            // Already in YYYY-MM-DD format
            if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return strVal;
            }

            // DD-MM-YYYY format
            if (strVal.match(/^\d{2}-\d{2}-\d{4}$/)) {
                const parts = strVal.split('-');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            // DD/MM/YYYY format
            if (strVal.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const parts = strVal.split('/');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            // ✅ MM/DD/YYYY format (Your Excel file format!)
            if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                const parts = strVal.split('/');
                const month = String(parts[0]).padStart(2, '0');
                const day = String(parts[1]).padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }

            console.warn(`⚠️ Could not parse date: ${strVal}`);
            return null;
        };

        // ✅ IMPROVED: More robust column name detection
        const normalizeColumnNames = (obj) => {
            const normalized = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase().trim();

                // Account column - exact match first, then contains
                if (lowerKey === 'account_name' || lowerKey === 'account') {
                    normalized.account_name = value;
                }
                // Category column - exact match first, then contains
                else if (lowerKey === 'category_name' || lowerKey === 'category') {
                    normalized.category_name = value;
                }
                // Mode column - mode or type
                else if (lowerKey === 'mode' || lowerKey === 'type' || lowerKey === 'transaction type') {
                    normalized.mode = value;
                }
                // Currency column
                else if (lowerKey === 'currency' || lowerKey === 'curr') {
                    normalized.currency = value;
                }
                // Amount column
                else if (lowerKey === 'amount' || lowerKey === 'amt' || lowerKey === 'value') {
                    normalized.amount = value;
                }
                // Transaction Date column - exact match
                else if (lowerKey === 'transaction_date' || lowerKey === 'date' || lowerKey === 'transaction date') {
                    normalized.transaction_date = value;
                }
                // Description column
                else if (lowerKey === 'description' || lowerKey === 'desc' || lowerKey === 'note' || lowerKey === 'remarks') {
                    normalized.description = value;
                }
            }
            return normalized;
        };

        const normalizeMode = (val) => {
            if (!val) return null;
            const lower = String(val).trim().toLowerCase();
            if (lower === 'income') return 'Income';
            if (lower === 'expense') return 'Expense';
            if (lower === 'credit card' || lower === 'cc') return 'Credit Card';
            return null;
        };

        const results = { success: 0, failed: 0, errors: [] };

        for (let i = 0; i < data.length; i++) {
            try {
                const row = normalizeColumnNames(data[i]);

                // ✅ DEBUG: Log what we're processing
                console.log(`📋 Processing Row ${i + 2}:`, {
                    account_name: row.account_name,
                    category_name: row.category_name,
                    mode: row.mode,
                    currency: row.currency,
                    amount: row.amount,
                    transaction_date: row.transaction_date,
                    description: row.description
                });

                // Validate amount
                const amount = parseFloat(row.amount);
                if (isNaN(amount) || amount <= 0) {
                    throw new Error(`Invalid amount: "${row.amount}". Must be a number > 0.`);
                }

                // Validate mode
                const mode = normalizeMode(row.mode);
                if (!mode) {
                    throw new Error(`Invalid mode: "${row.mode}". Use: Income, Expense, or Credit Card.`);
                }

                // Validate currency
                let currency = String(row.currency).trim().toUpperCase();
                if (currency !== 'INR' && currency !== 'SAR') {
                    throw new Error(`Invalid currency: "${currency}". Use INR or SAR.`);
                }

                // Validate and parse date
                const transDate = parseExcelDate(row.transaction_date);
                if (!transDate) {
                    throw new Error(`Invalid date: "${row.transaction_date}". Use MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD.`);
                }

                // Validate account and category names
                const accountName = String(row.account_name).trim();
                const categoryName = String(row.category_name).trim();

                if (!accountName || !categoryName) {
                    throw new Error('Account Name and Category Name are required.');
                }

                // Get or Create Account
                let accountResult = await db.query(
                    'SELECT id FROM accounts WHERE user_id = $1 AND name = $2 AND currency = $3',
                    [userId, accountName, currency]
                );

                let accountId = accountResult.rows.length > 0 ? accountResult.rows[0].id : null;

                if (!accountId) {
                    console.log(`✅ Creating new account: ${accountName} (${currency})`);
                    const res = await db.query(
                        'INSERT INTO accounts (user_id, name, currency) VALUES ($1, $2, $3) RETURNING id',
                        [userId, accountName, currency]
                    );
                    accountId = res.rows[0].id;
                }

                // Get or Create Category
                let categoryResult = await db.query(
                    'SELECT id FROM categories WHERE user_id = $1 AND name = $2 AND mode = $3',
                    [userId, categoryName, mode]
                );

                let categoryId = categoryResult.rows.length > 0 ? categoryResult.rows[0].id : null;

                if (!categoryId) {
                    console.log(`✅ Creating new category: ${categoryName} (${mode})`);
                    const res = await db.query(
                        'INSERT INTO categories (user_id, name, mode) VALUES ($1, $2, $3) RETURNING id',
                        [userId, categoryName, mode]
                    );
                    categoryId = res.rows[0].id;
                }

                // Insert Transaction
                await db.query(
                    `INSERT INTO transactions (user_id, currency, account_id, mode, category_id, transaction_date, description, amount)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [userId, currency, accountId, mode, categoryId, transDate, row.description || '', amount]
                );

                results.success++;
                console.log(`✅ Row ${i + 2} imported successfully`);

            } catch (error) {
                results.failed++;
                const errorMsg = `Row ${i + 2}: ${error.message}`;
                results.errors.push(errorMsg);
                console.error(`❌ ${errorMsg}`);
            }
        }

        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json({
            success: true,
            message: `✅ Processed ${data.length} rows. Success: ${results.success}, Failed: ${results.failed}`,
            results
        });

    } catch (error) {
        console.error('❌ Import error:', error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: error.message });
    }
});


// ACCOUNTS ENDPOINTS

router.get('/accounts', async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency } = req.query;

        let query = 'SELECT * FROM accounts WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (currency) {
            query += ` AND currency = $${paramIndex}`;
            params.push(currency);
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);
        const accounts = result.rows;

        res.json({ success: true, accounts: accounts });
    } catch (error) {
        console.error('❌ Error fetching accounts:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/accounts', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, currency } = req.body;

        if (!name || !currency) {
            return res.status(400).json({ success: false, message: 'Name and currency required' });
        }

        const result = await db.query(
            'INSERT INTO accounts (user_id, name, currency) VALUES ($1, $2, $3) RETURNING id',
            [userId, name, currency]
        );

        const account = result.rows[0];

        res.json({
            success: true,
            message: 'Account created successfully',
            id: account?.id || null
        });
    } catch (error) {
        console.error('❌ Error creating account:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/accounts/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, currency } = req.body;

        await db.query(
            'UPDATE accounts SET name = $1, currency = $2 WHERE id = $3 AND user_id = $4',
            [name, currency, id, userId]
        );

        res.json({ success: true, message: 'Account updated successfully' });
    } catch (error) {
        console.error('❌ Error updating account:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/accounts/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM accounts WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ success: false, message: 'Account not found' });
        }

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting account:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// CATEGORIES ENDPOINTS

router.get('/categories', async (req, res) => {
    try {
        const userId = req.user.id;
        const { mode } = req.query;

        let query = 'SELECT * FROM categories WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (mode) {
            query += ` AND mode = $${paramIndex}`;
            params.push(mode);
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);
        const categories = result.rows;

        res.json({ success: true, categories: categories });
    } catch (error) {
        console.error('❌ Error fetching categories:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, mode } = req.body;

        if (!name || !mode) {
            return res.status(400).json({ success: false, message: 'Name and mode required' });
        }

        const result = await db.query(
            'INSERT INTO categories (user_id, name, mode) VALUES ($1, $2, $3) RETURNING id',
            [userId, name, mode]
        );

        const category = result.rows[0];

        res.json({
            success: true,
            message: 'Category created successfully',
            id: category?.id || null
        });
    } catch (error) {
        console.error('❌ Error creating category:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, mode } = req.body;

        await db.query(
            'UPDATE categories SET name = $1, mode = $2 WHERE id = $3 AND user_id = $4',
            [name, mode, id, userId]
        );

        res.json({ success: true, message: 'Category updated successfully' });
    } catch (error) {
        console.error('❌ Error updating category:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM categories WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ success: false, message: 'Category not found' });
        }

        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting category:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// STATISTICS ENDPOINTS

router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get INR Income
        const inrIncomeResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::NUMERIC as total FROM transactions 
             WHERE user_id = $1 AND mode = 'Income' AND currency = 'INR'`,
            [userId]
        );

        // Get INR Expense
        const inrExpenseResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::NUMERIC as total FROM transactions 
             WHERE user_id = $1 AND mode = 'Expense' AND currency = 'INR'`,
            [userId]
        );

        // Get INR Credit Card
        const inrCreditCardResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::NUMERIC as total FROM transactions 
             WHERE user_id = $1 AND mode = 'Credit Card' AND currency = 'INR'`,
            [userId]
        );

        // Get SAR Income
        const sarIncomeResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::NUMERIC as total FROM transactions 
             WHERE user_id = $1 AND mode = 'Income' AND currency = 'SAR'`,
            [userId]
        );

        // Get SAR Expense
        const sarExpenseResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::NUMERIC as total FROM transactions 
             WHERE user_id = $1 AND mode = 'Expense' AND currency = 'SAR'`,
            [userId]
        );

        // Get SAR Credit Card
        const sarCreditCardResult = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::NUMERIC as total FROM transactions 
             WHERE user_id = $1 AND mode = 'Credit Card' AND currency = 'SAR'`,
            [userId]
        );

        const inrIncome = parseFloat(inrIncomeResult.rows[0].total) || 0;
        const inrExpense = parseFloat(inrExpenseResult.rows[0].total) || 0;
        const inrCreditCard = parseFloat(inrCreditCardResult.rows[0].total) || 0;
        const sarIncome = parseFloat(sarIncomeResult.rows[0].total) || 0;
        const sarExpense = parseFloat(sarExpenseResult.rows[0].total) || 0;
        const sarCreditCard = parseFloat(sarCreditCardResult.rows[0].total) || 0;

        res.json({
            success: true,
            summary: {
                inr: {
                    income: parseFloat(inrIncome.toFixed(2)),
                    expense: parseFloat(inrExpense.toFixed(2)),
                    creditCard: parseFloat(inrCreditCard.toFixed(2)),
                    balance: parseFloat((inrIncome - inrExpense).toFixed(2))
                },
                sar: {
                    income: parseFloat(sarIncome.toFixed(2)),
                    expense: parseFloat(sarExpense.toFixed(2)),
                    creditCard: parseFloat(sarCreditCard.toFixed(2)),
                    balance: parseFloat((sarIncome - sarExpense).toFixed(2))
                }
            }
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ============================================
// EXPORTS
// ============================================

module.exports = router;