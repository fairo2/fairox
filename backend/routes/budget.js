const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// ============================================
// SET BUDGET LIMIT (POST /api/budget/limits)
// ============================================
router.post('/limits', authMiddleware, async (req, res) => {
    try {
        console.log('📥 POST /api/budget/limits - Setting budget limit');
        console.log('User ID:', req.user.id);
        console.log('Body:', req.body);
        
        const { categoryId, currency, monthlyLimit, alertThreshold } = req.body;
        const userId = req.user.id;
        
        // ✅ VALIDATION
        if (!categoryId || !currency || !monthlyLimit || !alertThreshold) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // ✅ FIXED: PostgreSQL ON CONFLICT syntax
        const query = `
            INSERT INTO budget_limits 
            (user_id, category_id, currency, monthly_limit, alert_threshold)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, category_id, currency) 
            DO UPDATE SET 
                monthly_limit = $4,
                alert_threshold = $5,
                updated_at = NOW()
            RETURNING id
        `;
        
        const [result] = await db.query(query, [
            userId,
            parseInt(categoryId),
            currency,
            parseFloat(monthlyLimit),
            parseInt(alertThreshold)
        ]);
        
        console.log('✅ Budget limit set');
        
        res.json({
            success: true,
            message: 'Budget limit set successfully!',
            id: result?.id || null
        });
        
    } catch (error) {
        console.error('❌ Error setting budget limit:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting budget limit',
            error: error.message
        });
    }
});

// ============================================
// GET BUDGET STATUS (GET /api/budget/status)
// ============================================
router.get('/status', authMiddleware, async (req, res) => {
    try {
        console.log('📤 GET /api/budget/status - Fetching for user:', req.user.id);
        
        // ✅ FIXED: PostgreSQL date functions and parameter syntax
        const query = `
            SELECT 
                bl.id,
                bl.user_id,
                bl.category_id,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                c.name as category_name,
                COALESCE(SUM(t.amount), 0) as current_spending,
                ROUND((COALESCE(SUM(t.amount), 0)::NUMERIC / bl.monthly_limit::NUMERIC) * 100, 2) as percentage_used
            FROM budget_limits bl
            LEFT JOIN categories c ON bl.category_id = c.id
            LEFT JOIN transactions t ON t.category_id = bl.category_id 
                AND t.user_id = bl.user_id 
                AND t.currency = bl.currency
                AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            WHERE bl.user_id = $1
            GROUP BY bl.id, bl.user_id, bl.category_id, bl.currency, bl.monthly_limit, bl.alert_threshold, c.name
            ORDER BY bl.created_at DESC
        `;
        
        const [budgets] = await db.query(query, [req.user.id]);
        
        console.log('✅ Found:', budgets.length, 'budget limits');
        console.log('📝 Query Details - Including modes: Expense, Credit Card, Debit Card, Cash Payment');
        
        // ✅ Generate alerts
        const alerts = budgets
            .filter(b => parseFloat(b.percentage_used) >= parseFloat(b.alert_threshold))
            .map(b => ({
                budgetId: b.id,
                categoryName: b.category_name,
                message: `⚠️ ${b.category_name}: ${b.percentage_used}% of budget used (${b.currency} ${parseFloat(b.current_spending).toFixed(2)} / ${parseFloat(b.monthly_limit).toFixed(2)})`,
                alertType: parseFloat(b.percentage_used) >= 100 ? 'Critical' : 'Warning',
                percentageUsed: b.percentage_used,
                threshold: b.alert_threshold
            }));
        
        // ✅ Map field names for frontend compatibility
        const mappedBudgets = budgets.map(b => ({
            id: b.id,
            categoryid: b.category_id,
            category_id: b.category_id,
            categoryname: b.category_name,
            category_name: b.category_name,
            currency: b.currency,
            monthlylimit: parseFloat(b.monthly_limit),
            monthly_limit: parseFloat(b.monthly_limit),
            alertthreshold: parseFloat(b.alert_threshold),
            alert_threshold: parseFloat(b.alert_threshold),
            currentspending: parseFloat(b.current_spending),
            current_spending: parseFloat(b.current_spending),
            percentageused: parseFloat(b.percentage_used),
            percentage_used: parseFloat(b.percentage_used)
        }));
        
        res.json({
            success: true,
            budget_status: mappedBudgets,
            budgetstatus: mappedBudgets,
            alerts: alerts
        });
        
    } catch (error) {
        console.error('❌ Error fetching budget status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching budget status',
            error: error.message
        });
    }
});

// ============================================
// DELETE BUDGET LIMIT (DELETE /api/budget/:id)
// ============================================
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('🗑️ DELETE /api/budget/:id - Deleting:', id);
        
        // ✅ FIXED: PostgreSQL parameter syntax
        const deleteQuery = `DELETE FROM budget_limits WHERE id = $1 AND user_id = $2`;
        
        // ✅ Alternative: Soft delete (uncomment if you have is_active column)
        // const deleteQuery = `UPDATE budget_limits SET is_active = false WHERE id = $1 AND user_id = $2`;
        
        const [result] = await db.query(deleteQuery, [$1 = id, $2 = userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Budget limit not found'
            });
        }
        
        console.log('✅ Deleted successfully');
        
        res.json({
            success: true,
            message: 'Budget limit deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting budget limit:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting budget limit',
            error: error.message
        });
    }
});

module.exports = router;
