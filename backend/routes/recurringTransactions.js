const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// ✅ CREATE recurring transaction
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
        
        // ✅ INSERT into database
        const insertQuery = `
            INSERT INTO recurring_transactions 
            (user_id, account_id, category_id, description, amount, mode, currency, frequency, start_date, end_date, next_due_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        // ✅ Use array destructuring with mysql2/promise
        const [result] = await db.query(insertQuery, [
            userId,
            parseInt(accountId),
            parseInt(categoryId),
            description && description.trim() !== '' ? description : 'Recurring Transaction',  // ✅ FIXED
            parseFloat(amount),
            mode || 'Income',
            currency || 'INR',
            frequency || 'Monthly',
            startDate,
            endDate || null,
            nextDueDate
        ]);
        
        console.log('✅ Inserted ID:', result.insertId);
        
        res.json({
            success: true,
            message: 'Recurring transaction created successfully!',
            id: result.insertId
        });
        
    } catch (error) {
        console.error('❌ Error creating recurring transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating recurring transaction',
            error: error.message
        });
    }
});

// ✅ GET all recurring transactions for user
router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log('📤 GET /api/recurring - Fetching for user:', req.user.id);
        
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
            WHERE rt.user_id = ?
            ORDER BY rt.created_at DESC
        `;
        
        const [results] = await db.query(selectQuery, [req.user.id]);
        
        console.log('✅ Found:', results.length, 'recurring transactions');
        
        // ✅ Map field names for frontend compatibility
        const mappedResults = results.map(row => ({
            id: row.id,
            accountname: row.account_name,
            account_name: row.account_name,
            categoryname: row.category_name,
            category_name: row.category_name,
            description: row.description,
            amount: row.amount,
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
        
        res.json({
            success: true,
            recurring_transactions: mappedResults
        });
        
    } catch (error) {
        console.error('❌ Error fetching recurring transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recurring transactions',
            error: error.message
        });
    }
});

// ✅ DELETE recurring transaction
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('🗑️ DELETE /api/recurring/:id - Deleting:', id);
        
        const deleteQuery = `DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?`;
        
        const [result] = await db.query(deleteQuery, [id, userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }
        
        console.log('✅ Deleted successfully');
        
        res.json({
            success: true,
            message: 'Recurring transaction deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting recurring transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting recurring transaction',
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
        
        if (typeof baseDate === 'string') {
            const [year, month, day] = baseDate.split('-');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (baseDate instanceof Date) {
            date = new Date(baseDate);
        } else {
            date = new Date();
        }
        
        if (isNaN(date.getTime())) {
            console.error('❌ Invalid date:', baseDate);
            return new Date().toISOString().split('T')[0];
        }
        
        switch(frequency) {
            case 'Daily': date.setDate(date.getDate() + 1); break;
            case 'Weekly': date.setDate(date.getDate() + 7); break;
            case 'Bi-weekly': date.setDate(date.getDate() + 14); break;
            case 'Monthly': date.setMonth(date.getMonth() + 1); break;
            case 'Quarterly': date.setMonth(date.getMonth() + 3); break;
            case 'Semi-annual': date.setMonth(date.getMonth() + 6); break;
            case 'Annual': date.setFullYear(date.getFullYear() + 1); break;
            default: date.setDate(date.getDate() + 1);
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('❌ Error calculating next due date:', error);
        return new Date().toISOString().split('T')[0];
    }
}

module.exports = router;
