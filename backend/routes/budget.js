// ============================================
// ✅ COMPLETE BUDGET.JS - EXPENSE + CREDIT CARD ONLY
// File: src/backend/routes/budget.js
// Database: PostgreSQL
// Fixed: Dec 4, 2025 - Only load Expense & Credit Card categories (NO Income)
// ============================================


const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');


console.log('✅ Budget routes loaded');


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
        
        // ✅ FIXED: PostgreSQL ON CONFLICT syntax with proper parameters
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
        
        const result = await db.query(query, [
            userId,
            parseInt(categoryId),
            currency,
            parseFloat(monthlyLimit),
            parseInt(alertThreshold)
        ]);
        
        // ✅ FIXED: Extract rows array from result
        const budgetLimit = result.rows[0];
        
        console.log('✅ Budget limit set:', budgetLimit?.id);
        
        res.json({
            success: true,
            message: 'Budget limit set successfully!',
            id: budgetLimit?.id || null
        });
        
    } catch (error) {
        console.error('❌ Error setting budget limit:', error.message);
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
        
        const userId = req.user.id;
        
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
        
        const result = await db.query(query, [userId]);
        
        // ✅ FIXED: Extract rows array from result
        const budgets = result.rows;
        
        console.log('✅ Found:', budgets.length, 'budget limits');
        console.log('📝 Query Details - Including modes: Expense, Credit Card, Debit Card, Cash Payment');
        
        if (!budgets || budgets.length === 0) {
            console.log('⚠️ No budgets set for this user');
            return res.json({
                success: true,
                budget_status: [],
                budgetstatus: [],
                alerts: []
            });
        }
        
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
        
        console.log('✅ Budget status response prepared');
        
        res.json({
            success: true,
            budget_status: mappedBudgets,
            budgetstatus: mappedBudgets,
            alerts: alerts
        });
        
    } catch (error) {
        console.error('❌ Error fetching budget status:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error fetching budget status',
            error: error.message
        });
    }
});




// ============================================
// ✅ GET CATEGORIES FOR BUDGET DROPDOWN
// (GET /api/budget/categories)
// FIXED: Only returns Expense & Credit Card modes (NO Income)
// ============================================


router.get('/categories', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;


        console.log('📤 GET /api/budget/categories - Fetching for user:', userId);


        // ✅ FIXED: Only fetch Expense and Credit Card categories
        // These are the only categories that need budget tracking
        const query = `
            SELECT DISTINCT 
                c.id, 
                c.name, 
                c.mode,
                c.user_id
            FROM categories c
            WHERE c.user_id = $1
            AND c.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            ORDER BY c.mode ASC, c.name ASC
        `;


        const result = await db.query(query, [userId]);
        const categories = result.rows;


        console.log('✅ Found:', categories.length, 'budget-eligible categories');
        console.log('📝 Modes included: Expense, Credit Card, Debit Card, Cash Payment');
        console.log('⚠️ Income categories excluded (no budget tracking needed)');


        if (!categories || categories.length === 0) {
            console.log('⚠️ No Expense/Credit Card categories found');
            return res.json({
                success: true,
                categories: [],
                total: 0,
                message: 'Please create Expense or Credit Card categories first'
            });
        }


        // ✅ Map categories with mode labels for frontend clarity
        const mappedCategories = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            mode: cat.mode,
            displayName: `${cat.name} (${cat.mode})`
        }));


        res.json({
            success: true,
            categories: mappedCategories,
            total: mappedCategories.length,
            note: 'Only Expense and Credit Card categories shown - for budget tracking'
        });


    } catch (error) {
        console.error('❌ Error fetching budget categories:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching budget categories',
            error: error.message
        });
    }
});




// ============================================
// GET BUDGET BY ID (GET /api/budget/:id)
// ============================================


router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('📤 GET /api/budget/:id - Fetching:', id);
        
        // ✅ FIXED: PostgreSQL parameter syntax
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
                ROUND((COALESCE(SUM(t.amount), 0)::NUMERIC / bl.monthly_limit::NUMERIC) * 100, 2) as percentage_used,
                bl.created_at,
                bl.updated_at
            FROM budget_limits bl
            LEFT JOIN categories c ON bl.category_id = c.id
            LEFT JOIN transactions t ON t.category_id = bl.category_id 
                AND t.user_id = bl.user_id 
                AND t.currency = bl.currency
                AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            WHERE bl.id = $1 AND bl.user_id = $2
            GROUP BY bl.id, bl.user_id, bl.category_id, bl.currency, bl.monthly_limit, bl.alert_threshold, c.name
        `;
        
        const result = await db.query(query, [parseInt(id), userId]);
        
        // ✅ FIXED: Extract rows array from result
        const budgets = result.rows;
        
        if (!budgets || budgets.length === 0) {
            console.log('❌ Budget not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Budget not found'
            });
        }
        
        const budget = budgets[0];
        
        console.log('✅ Budget retrieved:', budget.id);
        
        res.json({
            success: true,
            budget: {
                id: budget.id,
                category_id: budget.category_id,
                category_name: budget.category_name,
                currency: budget.currency,
                monthly_limit: parseFloat(budget.monthly_limit),
                alert_threshold: parseFloat(budget.alert_threshold),
                current_spending: parseFloat(budget.current_spending),
                percentage_used: parseFloat(budget.percentage_used),
                created_at: budget.created_at,
                updated_at: budget.updated_at
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching budget:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching budget',
            error: error.message
        });
    }
});




// ============================================
// UPDATE BUDGET LIMIT (PUT /api/budget/:id)
// ============================================


router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { monthlyLimit, alertThreshold } = req.body;
        const userId = req.user.id;
        
        console.log('📝 PUT /api/budget/:id - Updating:', id);
        
        // ✅ VALIDATION
        if (!monthlyLimit || !alertThreshold) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // ✅ FIXED: PostgreSQL parameter syntax
        const query = `
            UPDATE budget_limits 
            SET monthly_limit = $1, alert_threshold = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            RETURNING id, category_id, currency, monthly_limit, alert_threshold
        `;
        
        const result = await db.query(query, [
            parseFloat(monthlyLimit),
            parseInt(alertThreshold),
            parseInt(id),
            userId
        ]);
        
        // ✅ FIXED: Extract rows array from result
        const budgets = result.rows;
        
        if (!budgets || budgets.length === 0) {
            console.log('❌ Budget not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Budget not found'
            });
        }
        
        const budget = budgets[0];
        
        console.log('✅ Budget updated:', budget.id);
        
        res.json({
            success: true,
            message: 'Budget updated successfully',
            budget: {
                id: budget.id,
                category_id: budget.category_id,
                currency: budget.currency,
                monthly_limit: parseFloat(budget.monthly_limit),
                alert_threshold: parseFloat(budget.alert_threshold)
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating budget:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error updating budget',
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
        
        // ✅ FIXED: PostgreSQL parameter syntax with proper variable names
        const deleteQuery = `
            DELETE FROM budget_limits 
            WHERE id = $1 AND user_id = $2
        `;
        
        const result = await db.query(deleteQuery, [parseInt(id), userId]);
        
        // ✅ FIXED: Check rowCount instead of affectedRows
        const affectedRows = result.rowCount;
        
        if (affectedRows === 0) {
            console.log('❌ Budget not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Budget limit not found'
            });
        }
        
        console.log('✅ Budget deleted successfully:', id);
        
        res.json({
            success: true,
            message: 'Budget limit deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting budget limit:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error deleting budget limit',
            error: error.message
        });
    }
});




// ============================================
// GET BUDGET ALERTS (GET /api/budget/alerts/all)
// ============================================


router.get('/alerts/all', authMiddleware, async (req, res) => {
    try {
        console.log('🔔 GET /api/budget/alerts - Fetching for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ Query to get all budgets with their current spending
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
            ORDER BY percentage_used DESC
        `;
        
        const result = await db.query(query, [userId]);
        
        // ✅ FIXED: Extract rows array from result
        const budgets = result.rows;
        
        // Generate detailed alerts
        const alerts = budgets.map(b => {
            const percentUsed = parseFloat(b.percentage_used);
            const threshold = parseFloat(b.alert_threshold);
            const isAlert = percentUsed >= threshold;
            const isCritical = percentUsed >= 100;
            
            return {
                budgetId: b.id,
                categoryName: b.category_name,
                currency: b.currency,
                monthlyLimit: parseFloat(b.monthly_limit),
                currentSpending: parseFloat(b.current_spending),
                percentageUsed: percentUsed,
                threshold: threshold,
                hasAlert: isAlert,
                alertType: isCritical ? 'Critical' : (isAlert ? 'Warning' : 'OK'),
                message: isAlert 
                    ? `⚠️ ${b.category_name}: ${percentUsed}% of budget used (${b.currency} ${parseFloat(b.current_spending).toFixed(2)} / ${parseFloat(b.monthly_limit).toFixed(2)})`
                    : `✅ ${b.category_name}: ${percentUsed}% of budget used`,
                remainingBudget: Math.max(0, parseFloat(b.monthly_limit) - parseFloat(b.current_spending))
            };
        });
        
        console.log('✅ Found:', alerts.length, 'budgets');
        
        res.json({
            success: true,
            alerts: alerts,
            summary: {
                total: alerts.length,
                warnings: alerts.filter(a => a.alertType === 'Warning').length,
                critical: alerts.filter(a => a.alertType === 'Critical').length,
                ok: alerts.filter(a => a.alertType === 'OK').length
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching alerts:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching alerts',
            error: error.message
        });
    }
});




module.exports = router;