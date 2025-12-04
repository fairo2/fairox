// ============================================
// ✅ COMPLETE BUDGET.JS - COMBINED EXPENSE & CREDIT CARD
// File: src/backend/routes/budget.js
// Database: PostgreSQL
// Fixed: Dec 4, 2025 - Expense & Credit Card COMBINED for budget calculation
// ✅ UPDATED: Routes match BUDGET_API_URL format (with underscores)
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

console.log('✅ Budget routes loaded');

// ============================================
// SET BUDGET LIMIT (POST /api/budget/limits)
// Frontend: fetch(`${BUDGET_API_URL}/limits`, {...})
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
// Frontend: fetch(`${BUDGET_API_URL}/status`, {...})
// ✅ COMBINED: Expense + Credit Card spending tracked together
// ============================================

router.get('/status', authMiddleware, async (req, res) => {
    try {
        console.log('📤 GET /api/budget/status - Fetching for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ COMBINED CALCULATION: Expense + Credit Card spending together
        // This query sums spending from BOTH Expense and Credit Card modes for the same category
        const query = `
            SELECT 
                bl.id,
                bl.user_id,
                bl.category_id,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                c.name as category_name,
                -- ✅ COMBINED: Sum from Expense AND Credit Card modes
                COALESCE(SUM(CASE 
                    WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount 
                    ELSE 0 
                END), 0) as current_spending,
                ROUND((COALESCE(SUM(CASE 
                    WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount 
                    ELSE 0 
                END), 0)::NUMERIC / bl.monthly_limit::NUMERIC) * 100, 2) as percentage_used
            FROM budget_limits bl
            LEFT JOIN categories c ON bl.category_id = c.id
            LEFT JOIN transactions t ON t.category_id = bl.category_id 
                AND t.user_id = bl.user_id 
                AND t.currency = bl.currency
                AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                -- ✅ COMBINED: Include both Expense and Credit Card modes
                AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            WHERE bl.user_id = $1
            GROUP BY bl.id, bl.user_id, bl.category_id, bl.currency, bl.monthly_limit, bl.alert_threshold, c.name
            ORDER BY bl.created_at DESC
        `;
        
        const result = await db.query(query, [userId]);
        
        // ✅ FIXED: Extract rows array from result
        const budgets = result.rows;
        
        console.log('✅ Found:', budgets.length, 'budget limits');
        console.log('📝 Query Details - COMBINED modes: Expense + Credit Card + Debit Card + Cash Payment');
        console.log('💡 Calculation: Spending from all modes summed together for accurate budget tracking');
        
        if (!budgets || budgets.length === 0) {
            console.log('⚠️ No budgets set for this user');
            return res.json({
                success: true,
                budget_status: [],
                budgetstatus: [],
                alerts: []
            });
        }
        
        // ✅ Generate alerts based on COMBINED spending
        const alerts = budgets
            .filter(b => parseFloat(b.percentage_used) >= parseFloat(b.alert_threshold))
            .map(b => ({
                budgetId: b.id,
                categoryName: b.category_name,
                message: `⚠️ ${b.category_name}: ${b.percentage_used}% of budget used (${b.currency} ${parseFloat(b.current_spending).toFixed(2)} / ${parseFloat(b.monthly_limit).toFixed(2)}) - Combined from Expense + Credit Card`,
                alertType: parseFloat(b.percentage_used) >= 100 ? 'Critical' : 'Warning',
                percentageUsed: b.percentage_used,
                threshold: b.alert_threshold,
                combinedSpending: true
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
            percentage_used: parseFloat(b.percentage_used),
            combinedSpending: true,
            note: 'Combined spending from Expense + Credit Card modes'
        }));
        
        console.log('✅ Budget status response prepared with COMBINED calculations');
        
        res.json({
            success: true,
            budget_status: mappedBudgets,
            budgetstatus: mappedBudgets,
            alerts: alerts,
            note: 'All spending modes (Expense, Credit Card, Debit Card, Cash Payment) combined for budget calculation'
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
// Frontend: fetch(`${BUDGET_API_URL}/categories`, {...})
// FIXED: Only returns unique categories (Expense & Credit Card COMBINED)
// ============================================

router.get('/categories', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('📤 GET /api/budget/categories - Fetching for user:', userId);

        // ✅ COMBINED: Get UNIQUE categories (same category may have both Expense and Credit Card modes)
        // We only need the category ID and name, not the mode
        const query = `
            SELECT DISTINCT 
                c.id, 
                c.name
            FROM categories c
            WHERE c.user_id = $1
            AND c.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            ORDER BY c.name ASC
        `;

        const result = await db.query(query, [userId]);
        const categories = result.rows;

        console.log('✅ Found:', categories.length, 'unique categories');
        console.log('📝 Modes COMBINED: Expense + Credit Card + Debit Card + Cash Payment');
        console.log('💡 Each category can have spending from multiple modes - all tracked together');

        if (!categories || categories.length === 0) {
            console.log('⚠️ No categories found for budget tracking');
            return res.json({
                success: true,
                categories: [],
                total: 0,
                message: 'Please create Expense or Credit Card categories first',
                note: 'Spending from all modes will be combined for budget calculation'
            });
        }

        // ✅ Map categories - NO mode shown since we're combining them
        const mappedCategories = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            displayName: cat.name
        }));

        res.json({
            success: true,
            categories: mappedCategories,
            total: mappedCategories.length,
            note: 'Combined budget tracking - Expense, Credit Card, Debit Card, and Cash Payment modes tracked together',
            combinedTracking: true
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
// Frontend: fetch(`${BUDGET_API_URL}/${id}`, {...})
// ✅ COMBINED: Shows spending from all modes together
// ============================================

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log('📤 GET /api/budget/:id - Fetching:', id);
        
        // ✅ COMBINED: Sum spending from all modes
        const query = `
            SELECT 
                bl.id,
                bl.user_id,
                bl.category_id,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                c.name as category_name,
                -- ✅ COMBINED spending
                COALESCE(SUM(CASE 
                    WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount 
                    ELSE 0 
                END), 0) as current_spending,
                ROUND((COALESCE(SUM(CASE 
                    WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount 
                    ELSE 0 
                END), 0)::NUMERIC / bl.monthly_limit::NUMERIC) * 100, 2) as percentage_used,
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
        console.log('💡 Spending includes: Expense, Credit Card, Debit Card, Cash Payment modes');
        
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
                updated_at: budget.updated_at,
                combinedSpending: true,
                note: 'Spending combined from Expense, Credit Card, Debit Card, and Cash Payment modes'
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
// Frontend: fetch(`${BUDGET_API_URL}/${id}`, {method: 'PUT', ...})
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
// Frontend: fetch(`${BUDGET_API_URL}/${id}`, {method: 'DELETE', ...})
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
// GET BUDGET ALERTS (GET /api/budget/alerts)
// Frontend: fetch(`${BUDGET_API_URL}/alerts`, {...})
// ✅ COMBINED: Shows alerts based on combined spending
// ============================================

router.get('/alerts', authMiddleware, async (req, res) => {
    try {
        console.log('🔔 GET /api/budget/alerts - Fetching for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ COMBINED: Get all budgets with COMBINED spending calculation
        const query = `
            SELECT 
                bl.id,
                bl.user_id,
                bl.category_id,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                c.name as category_name,
                -- ✅ COMBINED spending from all modes
                COALESCE(SUM(CASE 
                    WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount 
                    ELSE 0 
                END), 0) as current_spending,
                ROUND((COALESCE(SUM(CASE 
                    WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount 
                    ELSE 0 
                END), 0)::NUMERIC / bl.monthly_limit::NUMERIC) * 100, 2) as percentage_used
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
        
        // Generate detailed alerts based on COMBINED spending
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
                    ? `⚠️ ${b.category_name}: ${percentUsed}% of budget used (${b.currency} ${parseFloat(b.current_spending).toFixed(2)} / ${parseFloat(b.monthly_limit).toFixed(2)}) - Combined Expense + Credit Card spending`
                    : `✅ ${b.category_name}: ${percentUsed}% of budget used - Combined Expense + Credit Card spending`,
                remainingBudget: Math.max(0, parseFloat(b.monthly_limit) - parseFloat(b.current_spending)),
                combinedSpending: true,
                note: 'Includes spending from Expense, Credit Card, Debit Card, and Cash Payment modes'
            };
        });
        
        console.log('✅ Found:', alerts.length, 'budgets with COMBINED spending calculation');
        console.log('💡 Each budget tracks all spending modes together for accurate totals');
        
        res.json({
            success: true,
            alerts: alerts,
            summary: {
                total: alerts.length,
                warnings: alerts.filter(a => a.alertType === 'Warning').length,
                critical: alerts.filter(a => a.alertType === 'Critical').length,
                ok: alerts.filter(a => a.alertType === 'OK').length
            },
            note: 'All budgets calculated with COMBINED spending from Expense, Credit Card, Debit Card, and Cash Payment modes'
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