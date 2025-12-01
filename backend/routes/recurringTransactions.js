// ============================================
// ✅ COMPLETE RECURRING.JS - PRODUCTION READY
// File: src/backend/routes/recurring.js
// Database: PostgreSQL
// Fixed: Dec 1, 2025
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

console.log('✅ Recurring transactions routes loaded');

// ============================================
// CREATE RECURRING TRANSACTION (POST /api/recurring)
// ============================================

router.post('/', authMiddleware, async (req, res) => {
    try {
        console.log('📥 POST /api/recurring - Creating recurring transaction');
        console.log('User ID:', req.user.id);
        console.log('Body:', req.body);
        
        const { accountId, categoryId, description, amount, mode, currency, frequency, startDate, endDate } = req.body;
        const userId = req.user.id;
        
        // ✅ VALIDATION
        if (!accountId || !categoryId || !amount || !startDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: accountId, categoryId, amount, startDate'
            });
        }
        
        // ✅ Calculate next due date
        const nextDueDate = calculateNextDueDate(startDate, frequency);
        
        // ✅ FIXED: PostgreSQL syntax with RETURNING clause and proper parameter passing
        const insertQuery = `
            INSERT INTO recurring_transactions 
            (user_id, account_id, category_id, description, amount, mode, currency, frequency, start_date, end_date, next_due_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            RETURNING id
        `;
        
        const result = await db.query(insertQuery, [
            userId,
            parseInt(accountId),
            parseInt(categoryId),
            description && description.trim() !== '' ? description : 'Recurring Transaction',
            parseFloat(amount),
            mode || 'Income',
            currency || 'INR',
            frequency || 'Monthly',
            startDate,
            endDate || null,
            nextDueDate
        ]);
        
        // ✅ FIXED: Extract rows array from result
        const recurringTransaction = result.rows[0];
        
        console.log('✅ Recurring transaction created:', recurringTransaction?.id);
        
        res.json({
            success: true,
            message: 'Recurring transaction created successfully!',
            id: recurringTransaction?.id || null
        });
        
    } catch (error) {
        console.error('❌ Error creating recurring transaction:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error creating recurring transaction',
            error: error.message
        });
    }
});


// ============================================
// GET ALL RECURRING TRANSACTIONS (GET /api/recurring)
// ============================================

router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log('📤 GET /api/recurring - Fetching for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ FIXED: PostgreSQL query with proper parameter placeholder
        const selectQuery = `
            SELECT 
                rt.id,
                rt.user_id,
                rt.account_id,
                rt.category_id,
                rt.description,
                rt.amount,
                rt.mode,
                rt.currency,
                rt.frequency,
                rt.start_date,
                rt.end_date,
                rt.next_due_date,
                rt.created_at,
                c.name as category_name,
                a.name as account_name
            FROM recurring_transactions rt
            LEFT JOIN categories c ON rt.category_id = c.id
            LEFT JOIN accounts a ON rt.account_id = a.id
            WHERE rt.user_id = $1
            ORDER BY rt.created_at DESC
        `;
        
        const result = await db.query(selectQuery, [userId]);
        
        // ✅ FIXED: Extract rows array from result
        const recurringTransactions = result.rows;
        
        console.log('✅ Found:', recurringTransactions.length, 'recurring transactions');
        
        if (!recurringTransactions || recurringTransactions.length === 0) {
            console.log('⚠️ No recurring transactions found for this user');
            return res.json({
                success: true,
                recurring_transactions: []
            });
        }
        
        // ✅ Map field names for frontend compatibility
        const mappedResults = recurringTransactions.map(row => ({
            id: row.id,
            accountname: row.account_name,
            account_name: row.account_name,
            accountid: row.account_id,
            account_id: row.account_id,
            categoryname: row.category_name,
            category_name: row.category_name,
            categoryid: row.category_id,
            category_id: row.category_id,
            description: row.description,
            amount: parseFloat(row.amount),
            mode: row.mode,
            currency: row.currency,
            frequency: row.frequency,
            startDate: row.start_date,
            start_date: row.start_date,
            endDate: row.end_date,
            end_date: row.end_date,
            nextduedate: row.next_due_date,
            nextDueDate: row.next_due_date,
            next_due_date: row.next_due_date,
            created_at: row.created_at
        }));
        
        console.log('✅ Recurring transactions mapped for frontend');
        
        res.json({
            success: true,
            recurring_transactions: mappedResults
        });
        
    } catch (error) {
        console.error('❌ Error fetching recurring transactions:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error fetching recurring transactions',
            error: error.message
        });
    }
});


// ============================================
// GET SINGLE RECURRING TRANSACTION (GET /api/recurring/:id)
// ============================================

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('📤 GET /api/recurring/:id - Fetching:', id);
        
        // ✅ FIXED: PostgreSQL parameter syntax
        const query = `
            SELECT 
                rt.id,
                rt.user_id,
                rt.account_id,
                rt.category_id,
                rt.description,
                rt.amount,
                rt.mode,
                rt.currency,
                rt.frequency,
                rt.start_date,
                rt.end_date,
                rt.next_due_date,
                rt.created_at,
                c.name as category_name,
                a.name as account_name
            FROM recurring_transactions rt
            LEFT JOIN categories c ON rt.category_id = c.id
            LEFT JOIN accounts a ON rt.account_id = a.id
            WHERE rt.id = $1 AND rt.user_id = $2
        `;
        
        const result = await db.query(query, [parseInt(id), userId]);
        
        // ✅ FIXED: Extract rows array from result
        const recurringTransactions = result.rows;
        
        if (!recurringTransactions || recurringTransactions.length === 0) {
            console.log('❌ Recurring transaction not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }
        
        const transaction = recurringTransactions[0];
        
        console.log('✅ Recurring transaction retrieved:', transaction.id);
        
        res.json({
            success: true,
            recurring_transaction: {
                id: transaction.id,
                account_id: transaction.account_id,
                account_name: transaction.account_name,
                category_id: transaction.category_id,
                category_name: transaction.category_name,
                description: transaction.description,
                amount: parseFloat(transaction.amount),
                mode: transaction.mode,
                currency: transaction.currency,
                frequency: transaction.frequency,
                start_date: transaction.start_date,
                end_date: transaction.end_date,
                next_due_date: transaction.next_due_date,
                created_at: transaction.created_at
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching recurring transaction:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching recurring transaction',
            error: error.message
        });
    }
});


// ============================================
// UPDATE RECURRING TRANSACTION (PUT /api/recurring/:id)
// ============================================

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { accountId, categoryId, description, amount, mode, currency, frequency, startDate, endDate } = req.body;
        
        console.log('📝 PUT /api/recurring/:id - Updating:', id);
        
        // ✅ VALIDATION
        if (!accountId || !categoryId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // ✅ Calculate next due date
        const nextDueDate = calculateNextDueDate(startDate || new Date().toISOString().split('T')[0], frequency);
        
        // ✅ FIXED: PostgreSQL parameter syntax
        const query = `
            UPDATE recurring_transactions 
            SET account_id = $1, category_id = $2, description = $3, amount = $4, 
                mode = $5, currency = $6, frequency = $7, start_date = $8, 
                end_date = $9, next_due_date = $10
            WHERE id = $11 AND user_id = $12
            RETURNING id, account_id, category_id, description, amount, mode, currency, frequency, start_date, end_date, next_due_date
        `;
        
        const result = await db.query(query, [
            parseInt(accountId),
            parseInt(categoryId),
            description,
            parseFloat(amount),
            mode,
            currency,
            frequency,
            startDate,
            endDate || null,
            nextDueDate,
            parseInt(id),
            userId
        ]);
        
        // ✅ FIXED: Extract rows array from result
        const recurringTransactions = result.rows;
        
        if (!recurringTransactions || recurringTransactions.length === 0) {
            console.log('❌ Recurring transaction not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }
        
        const transaction = recurringTransactions[0];
        
        console.log('✅ Recurring transaction updated:', transaction.id);
        
        res.json({
            success: true,
            message: 'Recurring transaction updated successfully',
            recurring_transaction: {
                id: transaction.id,
                account_id: transaction.account_id,
                category_id: transaction.category_id,
                description: transaction.description,
                amount: parseFloat(transaction.amount),
                mode: transaction.mode,
                currency: transaction.currency,
                frequency: transaction.frequency,
                start_date: transaction.start_date,
                end_date: transaction.end_date,
                next_due_date: transaction.next_due_date
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating recurring transaction:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error updating recurring transaction',
            error: error.message
        });
    }
});


// ============================================
// DELETE RECURRING TRANSACTION (DELETE /api/recurring/:id)
// ============================================

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('🗑️ DELETE /api/recurring/:id - Deleting:', id);
        
        // ✅ FIXED: PostgreSQL parameter syntax
        const deleteQuery = `
            DELETE FROM recurring_transactions 
            WHERE id = $1 AND user_id = $2
        `;
        
        const result = await db.query(deleteQuery, [parseInt(id), userId]);
        
        // ✅ FIXED: Check rowCount (PostgreSQL) instead of affectedRows (MySQL)
        const affectedRows = result.rowCount;
        
        if (affectedRows === 0) {
            console.log('❌ Recurring transaction not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }
        
        console.log('✅ Recurring transaction deleted successfully:', id);
        
        res.json({
            success: true,
            message: 'Recurring transaction deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting recurring transaction:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error deleting recurring transaction',
            error: error.message
        });
    }
});


// ============================================
// GET RECURRING TRANSACTIONS DUE TODAY (GET /api/recurring/due-today)
// ============================================

router.get('/due-today', authMiddleware, async (req, res) => {
    try {
        console.log('📅 GET /api/recurring/due-today - Fetching for user:', req.user.id);
        
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];
        
        // ✅ FIXED: PostgreSQL query to get due transactions
        const query = `
            SELECT 
                rt.id,
                rt.account_id,
                rt.category_id,
                rt.description,
                rt.amount,
                rt.mode,
                rt.currency,
                rt.frequency,
                rt.start_date,
                rt.end_date,
                rt.next_due_date,
                c.name as category_name,
                a.name as account_name
            FROM recurring_transactions rt
            LEFT JOIN categories c ON rt.category_id = c.id
            LEFT JOIN accounts a ON rt.account_id = a.id
            WHERE rt.user_id = $1
            AND rt.next_due_date <= $2
            AND (rt.end_date IS NULL OR rt.end_date >= $2)
            ORDER BY rt.next_due_date ASC
        `;
        
        const result = await db.query(query, [userId, today]);
        
        // ✅ FIXED: Extract rows array from result
        const dueTransactions = result.rows;
        
        console.log('✅ Found:', dueTransactions.length, 'transactions due today or earlier');
        
        res.json({
            success: true,
            due_today: dueTransactions,
            count: dueTransactions.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching due transactions:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching due transactions',
            error: error.message
        });
    }
});


// ============================================
// EXECUTE RECURRING TRANSACTION (POST /api/recurring/:id/execute)
// ============================================

router.post('/:id/execute', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('⚡ POST /api/recurring/:id/execute - Executing:', id);
        
        // ✅ Get recurring transaction details
        const getQuery = `
            SELECT * FROM recurring_transactions 
            WHERE id = $1 AND user_id = $2
        `;
        
        const getResult = await db.query(getQuery, [parseInt(id), userId]);
        const recurring = getResult.rows[0];
        
        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }
        
        // ✅ Create transaction from recurring template
        const createTransactionQuery = `
            INSERT INTO transactions 
            (user_id, account_id, category_id, description, amount, mode, currency, transaction_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id
        `;
        
        const transactionResult = await db.query(createTransactionQuery, [
            userId,
            recurring.account_id,
            recurring.category_id,
            recurring.description,
            recurring.amount,
            recurring.mode,
            recurring.currency
        ]);
        
        // ✅ FIXED: Extract rows array from result
        const newTransaction = transactionResult.rows[0];
        
        // ✅ Update next due date
        const nextDueDate = calculateNextDueDate(recurring.next_due_date, recurring.frequency);
        
        const updateQuery = `
            UPDATE recurring_transactions 
            SET next_due_date = $1, last_executed_at = NOW()
            WHERE id = $2
        `;
        
        await db.query(updateQuery, [nextDueDate, parseInt(id)]);
        
        console.log('✅ Recurring transaction executed. New transaction ID:', newTransaction?.id);
        
        res.json({
            success: true,
            message: 'Recurring transaction executed successfully',
            transaction_id: newTransaction?.id,
            next_due_date: nextDueDate
        });
        
    } catch (error) {
        console.error('❌ Error executing recurring transaction:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error executing recurring transaction',
            error: error.message
        });
    }
});


// ============================================
// Helper function to calculate next due date
// ============================================

function calculateNextDueDate(baseDate, frequency) {
    try {
        let date;
        
        // ✅ Handle different date input formats
        if (typeof baseDate === 'string') {
            // Handle YYYY-MM-DD format
            if (baseDate.includes('-')) {
                const [year, month, day] = baseDate.split('-');
                date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                date = new Date(baseDate);
            }
        } else if (baseDate instanceof Date) {
            date = new Date(baseDate);
        } else {
            date = new Date();
        }
        
        // ✅ Validate date
        if (isNaN(date.getTime())) {
            console.error('❌ Invalid date:', baseDate);
            return new Date().toISOString().split('T')[0];
        }
        
        // ✅ Calculate next due date based on frequency
        switch(frequency) {
            case 'Daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'Weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'Bi-weekly':
                date.setDate(date.getDate() + 14);
                break;
            case 'Monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'Quarterly':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'Semi-annual':
                date.setMonth(date.getMonth() + 6);
                break;
            case 'Annual':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                date.setDate(date.getDate() + 1);
        }
        
        // ✅ Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('❌ Error calculating next due date:', error.message);
        return new Date().toISOString().split('T')[0];
    }
}


module.exports = router;