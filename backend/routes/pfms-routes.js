// ============================================
// CORRECTED PFMS-ROUTES.JS STRUCTURE
// The Template endpoint MUST be BEFORE authMiddleware
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

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
            },
            {
                account_name: 'HDFC',
                category_name: 'Utilities',
                mode: 'Expense',
                currency: 'INR',
                amount: 3000,
                transaction_date: '2025-11-28',
                description: 'Electricity bill'
            },
            {
                account_name: 'Cash',
                category_name: 'Transport',
                mode: 'Expense',
                currency: 'INR',
                amount: 1000,
                transaction_date: '2025-11-28',
                description: 'Taxi fare'
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
        console.error('Template generation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// 🔒 AUTH MIDDLEWARE (Applied to all routes below)
// ============================================

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
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
};

// Apply auth middleware to all routes below
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
            WHERE t.user_id = ?
        `;
        
        const params = [userId];

        if (currency) {
            query += ` AND t.currency = ?`;
            params.push(currency);
        }
        if (mode) {
            query += ` AND t.mode = ?`;
            params.push(mode);
        }
        if (from_date) {
            query += ` AND t.transaction_date >= ?`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND t.transaction_date <= ?`;
            params.push(to_date);
        }
        if (search) {
            query += ` AND (t.description LIKE ? OR a.name LIKE ? OR c.name LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY t.${sortColumn} ${sortDir}`;

        const countQuery = query.replace('SELECT t.*, a.name as account_name, c.name as category_name', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countQuery, params);
        const total = countResult[0].total;
        const pages = Math.ceil(total / limit);

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [transactions] = await db.query(query, params);

        res.json({
            success: true,
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
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

        const [accounts] = await db.query(
            'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
            [account_id, userId]
        );

        if (accounts.length === 0) {
            return res.status(403).json({ success: false, message: 'Account not found' });
        }

        const [result] = await db.query(
            `INSERT INTO transactions (user_id, currency, account_id, mode, category_id, transaction_date, description, amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, currency, account_id, mode, category_id, transaction_date, description, parsedAmount]
        );

        res.json({
            success: true,
            message: 'Transaction created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating transaction:', error);
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

        const [transactions] = await db.query(
            'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (transactions.length === 0) {
            return res.status(403).json({ success: false, message: 'Transaction not found' });
        }

        await db.query(
            `UPDATE transactions 
             SET currency = ?, account_id = ?, mode = ?, category_id = ?, transaction_date = ?, description = ?, amount = ?
             WHERE id = ? AND user_id = ?`,
            [currency, account_id, mode, category_id, transaction_date, description, parsedAmount, id, userId]
        );

        res.json({ success: true, message: 'Transaction updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/transactions/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const [result] = await db.query(
            'DELETE FROM transactions WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ success: false, message: 'Transaction not found' });
        }

        res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// IMPORT ENDPOINTS

router.post('/transactions/import-preview', upload.single('file'), async (req, res) => {
    try {
        const userId = req.user.id;

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
        console.error('Preview error:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/transactions/import', upload.single('file'), async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Read Excel file
        const workbook = XLSX.readFile(req.file.path);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // IMPORTANT: raw: false forces XLSX to try reading as strings, but strictly getting raw values is better for dates
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: true });

        if (!data || data.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        // Helper to handle Excel dates (Numbers like 45413)
        const parseExcelDate = (value) => {
            if (!value) return null;

            // Case 1: It's a number (Excel Serial Date)
            if (typeof value === 'number') {
                // Excel base date is Dec 30, 1899
                const date = new Date(Math.round((value - 25569) * 86400 * 1000));
                return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
            }

            // Case 2: It's a string
            const strVal = String(value).trim();
            
            // Try parsing standard formats
            if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) return strVal; // Already YYYY-MM-DD
            if (strVal.match(/^\d{2}-\d{2}-\d{4}$/)) return strVal.split('-').reverse().join('-'); // DD-MM-YYYY -> YYYY-MM-DD
            if (strVal.match(/^\d{2}\/\d{2}\/\d{4}$/)) return strVal.split('/').reverse().join('-'); // DD/MM/YYYY -> YYYY-MM-DD

            return null;
        };

        // Helper to normalize Mode (income -> Income)
        const normalizeMode = (val) => {
            if (!val) return null;
            const lower = String(val).trim().toLowerCase();
            if (lower === 'income') return 'Income';
            if (lower === 'expense') return 'Expense';
            if (lower === 'credit card' || lower === 'cc') return 'Credit Card';
            return null;
        };

        const normalizeColumnNames = (obj) => {
            const normalized = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase().trim();
                if (lowerKey.includes('account')) normalized.account_name = value;
                else if (lowerKey.includes('category')) normalized.category_name = value;
                else if (lowerKey === 'mode' || lowerKey.includes('type')) normalized.mode = value;
                else if (lowerKey.includes('currency') || lowerKey === 'curr') normalized.currency = value;
                else if (lowerKey === 'amount' || lowerKey.includes('amt')) normalized.amount = value;
                else if (lowerKey.includes('date')) normalized.transaction_date = value;
                else if (lowerKey.includes('desc') || lowerKey.includes('note')) normalized.description = value;
            }
            return normalized;
        };

        const results = { success: 0, failed: 0, errors: [] };

        for (let i = 0; i < data.length; i++) {
            try {
                const row = normalizeColumnNames(data[i]);

                // 1. FIX AMOUNT
                const amount = parseFloat(row.amount);
                if (isNaN(amount) || amount <= 0) {
                    throw new Error(`Invalid amount: "${row.amount}"`);
                }

                // 2. FIX MODE (Case Insensitive)
                const mode = normalizeMode(row.mode);
                if (!mode) {
                    throw new Error(`Invalid mode: "${row.mode}". Use Income, Expense, or Credit Card.`);
                }

                // 3. FIX CURRENCY (Case Insensitive)
                let currency = String(row.currency).trim().toUpperCase();
                if (currency !== 'INR' && currency !== 'SAR') {
                    throw new Error(`Invalid currency: "${currency}". Use INR or SAR.`);
                }

                // 4. FIX DATE (Handle 45413 and strings)
                const transDate = parseExcelDate(row.transaction_date);
                if (!transDate) {
                    throw new Error(`Invalid date: "${row.transaction_date}". Use YYYY-MM-DD or Excel Date format.`);
                }

                const accountName = String(row.account_name).trim();
                const categoryName = String(row.category_name).trim();

                if (!accountName || !categoryName) {
                    throw new Error('Account Name and Category Name are required.');
                }

                // --- DATABASE OPERATIONS ---

                // Get/Create Account
                let [accountResults] = await db.query(
                    'SELECT id FROM accounts WHERE user_id = ? AND name = ? AND currency = ?',
                    [userId, accountName, currency]
                );
                let accountId = accountResults.length > 0 ? accountResults[0].id : null;

                if (!accountId) {
                    const [res] = await db.query(
                        'INSERT INTO accounts (user_id, name, currency) VALUES (?, ?, ?)',
                        [userId, accountName, currency]
                    );
                    accountId = res.insertId;
                }

                // Get/Create Category
                let [categoryResults] = await db.query(
                    'SELECT id FROM categories WHERE user_id = ? AND name = ? AND mode = ?',
                    [userId, categoryName, mode]
                );
                let categoryId = categoryResults.length > 0 ? categoryResults[0].id : null;

                if (!categoryId) {
                    const [res] = await db.query(
                        'INSERT INTO categories (user_id, name, mode) VALUES (?, ?, ?)',
                        [userId, categoryName, mode]
                    );
                    categoryId = res.insertId;
                }

                // Insert Transaction
                await db.query(
                    `INSERT INTO transactions (user_id, currency, account_id, mode, category_id, transaction_date, description, amount)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, currency, accountId, mode, categoryId, transDate, row.description || '', amount]
                );

                results.success++;

            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${error.message}`);
            }
        }

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: `Processed ${data.length} rows. Success: ${results.success}, Failed: ${results.failed}`,
            results
        });

    } catch (error) {
        console.error('Import error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ACCOUNTS ENDPOINTS

router.get('/accounts', async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency } = req.query;

        let query = 'SELECT * FROM accounts WHERE user_id = ?';
        const params = [userId];

        if (currency) {
            query += ' AND currency = ?';
            params.push(currency);
        }

        query += ' ORDER BY created_at DESC';

        const [accounts] = await db.query(query, params);
        res.json({ success: true, accounts });
    } catch (error) {
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

        const [result] = await db.query(
            'INSERT INTO accounts (user_id, name, currency) VALUES (?, ?, ?)',
            [userId, name, currency]
        );

        res.json({
            success: true,
            message: 'Account created successfully',
            id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/accounts/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, currency } = req.body;

        await db.query(
            'UPDATE accounts SET name = ?, currency = ? WHERE id = ? AND user_id = ?',
            [name, currency, id, userId]
        );

        res.json({ success: true, message: 'Account updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/accounts/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const [result] = await db.query(
            'DELETE FROM accounts WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ success: false, message: 'Account not found' });
        }

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CATEGORIES ENDPOINTS

router.get('/categories', async (req, res) => {
    try {
        const userId = req.user.id;
        const { mode } = req.query;

        let query = 'SELECT * FROM categories WHERE user_id = ?';
        const params = [userId];

        if (mode) {
            query += ' AND mode = ?';
            params.push(mode);
        }

        query += ' ORDER BY created_at DESC';

        const [categories] = await db.query(query, params);
        res.json({ success: true, categories });
    } catch (error) {
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

        const [result] = await db.query(
            'INSERT INTO categories (user_id, name, mode) VALUES (?, ?, ?)',
            [userId, name, mode]
        );

        res.json({
            success: true,
            message: 'Category created successfully',
            id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, mode } = req.body;

        await db.query(
            'UPDATE categories SET name = ?, mode = ? WHERE id = ? AND user_id = ?',
            [name, mode, id, userId]
        );

        res.json({ success: true, message: 'Category updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const [result] = await db.query(
            'DELETE FROM categories WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ success: false, message: 'Category not found' });
        }

        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// STATISTICS ENDPOINTS

router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get INR Income
        const [inrIncomeResult] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE user_id = ? AND mode = 'Income' AND currency = 'INR'`,
            [userId]
        );

        // Get INR Expense
        const [inrExpenseResult] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE user_id = ? AND mode = 'Expense' AND currency = 'INR'`,
            [userId]
        );

        // Get INR Credit Card
        const [inrCreditCardResult] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE user_id = ? AND mode = 'Credit Card' AND currency = 'INR'`,
            [userId]
        );

        // Get SAR Income
        const [sarIncomeResult] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE user_id = ? AND mode = 'Income' AND currency = 'SAR'`,
            [userId]
        );

        // Get SAR Expense
        const [sarExpenseResult] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE user_id = ? AND mode = 'Expense' AND currency = 'SAR'`,
            [userId]
        );

        // Get SAR Credit Card
        const [sarCreditCardResult] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE user_id = ? AND mode = 'Credit Card' AND currency = 'SAR'`,
            [userId]
        );

        const inrIncome = parseFloat(inrIncomeResult[0].total) || 0;
        const inrExpense = parseFloat(inrExpenseResult[0].total) || 0;
        const inrCreditCard = parseFloat(inrCreditCardResult[0].total) || 0;
        const sarIncome = parseFloat(sarIncomeResult[0].total) || 0;
        const sarExpense = parseFloat(sarExpenseResult[0].total) || 0;
        const sarCreditCard = parseFloat(sarCreditCardResult[0].total) || 0;

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
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;