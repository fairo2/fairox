// ============================================
// ✅ COMPLETE OVERVIEW.JS - PRODUCTION READY
// File: src/backend/routes/overview.js
// Database: PostgreSQL
// Fixed: Dec 1, 2025
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

console.log('✅ Overview routes loaded');

// ============================================
// GET OVERVIEW SUMMARY DATA
// ============================================

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/summary - User:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ FIXED: PostgreSQL parameters ($1, $2, etc.)
        const transactionQuery = `
            SELECT 
                t.id,
                t.amount,
                t.mode,
                t.currency
            FROM transactions t
            WHERE t.user_id = $1
        `;
        
        const result = await db.query(transactionQuery, [userId]);
        
        // ✅ FIXED: Extract rows array from result object
        const transactions = result.rows;
        
        console.log('   Transactions fetched:', transactions.length);
        
        // ✅ Calculate totals by currency
        const summaryByCurrency = {};
        
        transactions.forEach(t => {
            if (!summaryByCurrency[t.currency]) {
                summaryByCurrency[t.currency] = {
                    currency: t.currency,
                    totalIncome: 0,
                    totalExpense: 0,
                    totalBalance: 0,
                    net: 0
                };
            }
            
            if (t.mode === 'Income') {
                summaryByCurrency[t.currency].totalIncome += parseFloat(t.amount);
            } else if (t.mode === 'Expense' || t.mode === 'Credit Card' || t.mode === 'Debit Card' || t.mode === 'Cash Payment') {
                summaryByCurrency[t.currency].totalExpense += parseFloat(t.amount);
            }
        });
        
        // Calculate net and balance
        Object.keys(summaryByCurrency).forEach(currency => {
            const summary = summaryByCurrency[currency];
            summary.net = summary.totalIncome - summary.totalExpense;
            summary.totalBalance = summary.totalIncome - summary.totalExpense;
        });
        
        console.log('✅ Overview summary calculated');
        
        res.json({
            success: true,
            summary: Object.values(summaryByCurrency)
        });
        
    } catch (error) {
        console.error('❌ Error fetching overview summary:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching overview summary',
            error: error.message
        });
    }
});


// ============================================
// GET CATEGORY BREAKDOWN FOR PIE CHART
// ============================================

router.get('/category-breakdown', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/category-breakdown - User:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ Get month/year from query parameter (or use current month)
        let month = parseInt(req.query.month) || new Date().getMonth() + 1;  // 1-12
        let year = parseInt(req.query.year) || new Date().getFullYear();
        
        console.log(`📅 Fetching data for: ${year}-${month.toString().padStart(2, '0')}`);
        
        // Validate month
        if (month < 1 || month > 12) {
            month = new Date().getMonth() + 1;
            year = new Date().getFullYear();
        }
        
        // ✅ FIXED: PostgreSQL syntax for category breakdown
        const categoryQuery = `
            SELECT 
                COALESCE(c.name, 'Uncategorized') as category_name,
                t.currency,
                COALESCE(SUM(t.amount), 0) as total_amount,
                COUNT(t.id) as transaction_count,
                STRING_AGG(DISTINCT t.mode, ', ') as modes
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = $1
            AND t.mode IN ('Expense', 'Credit Card')
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            AND EXTRACT(MONTH FROM t.transaction_date) = $3
            GROUP BY COALESCE(c.name, 'Uncategorized'), t.currency
            ORDER BY t.currency, total_amount DESC
        `;
        
        const result = await db.query(categoryQuery, [userId, year, month]);
        
        // ✅ FIXED: Extract rows array from PostgreSQL result object
        const categoryData = result.rows;
        
        console.log('📊 Raw category data fetched:', categoryData.length, 'records');
        
        if (!categoryData || categoryData.length === 0) {
            console.log('⚠️ No category data found for this month');
            return res.json({
                success: true,
                month: month,
                year: year,
                allCurrencies: {},
                categories: []
            });
        }
        
        // ✅ GROUP BY CURRENCY for frontend
        const allCurrencies = {};
        
        // ✅ FIXED: Iterate over rows array properly
        categoryData.forEach(item => {
            const currency = item.currency || 'INR';
            
            if (!allCurrencies[currency]) {
                allCurrencies[currency] = [];
            }
            
            allCurrencies[currency].push({
                category_name: item.category_name || 'Uncategorized',
                total_amount: parseFloat(item.total_amount),
                modes: item.modes || 'Expense',
                transaction_count: item.transaction_count
            });
        });
        
        console.log('✅ Grouped by currencies:', Object.keys(allCurrencies));
        
        res.json({
            success: true,
            month: month,
            year: year,
            allCurrencies: allCurrencies,
            categories: categoryData
        });
        
    } catch (error) {
        console.error('❌ Error fetching overview category breakdown:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error fetching overview category breakdown',
            error: error.message
        });
    }
});


// ============================================
// GET MONTHLY TREND DATA
// ============================================

router.get('/monthly-trend', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/monthly-trend - User:', req.user.id);
        
        const userId = req.user.id;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // ✅ FIXED: PostgreSQL syntax for monthly trend
        const trendQuery = `
            SELECT 
                EXTRACT(MONTH FROM t.transaction_date) as month,
                t.currency,
                SUM(CASE WHEN t.mode = 'Income' THEN t.amount ELSE 0 END) as total_income,
                SUM(CASE WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount ELSE 0 END) as total_expense,
                COUNT(t.id) as transaction_count
            FROM transactions t
            WHERE t.user_id = $1
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            GROUP BY EXTRACT(MONTH FROM t.transaction_date), t.currency
            ORDER BY EXTRACT(MONTH FROM t.transaction_date), t.currency
        `;
        
        const result = await db.query(trendQuery, [userId, year]);
        
        // ✅ FIXED: Extract rows array
        const trendData = result.rows;
        
        console.log('📊 Monthly trend data fetched:', trendData.length, 'records');
        
        res.json({
            success: true,
            year: year,
            data: trendData
        });
        
    } catch (error) {
        console.error('❌ Error fetching monthly trend:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching monthly trend',
            error: error.message
        });
    }
});


// ============================================
// GET TOP EXPENSES
// ============================================

router.get('/top-expenses', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/top-expenses - User:', req.user.id);
        
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // ✅ FIXED: PostgreSQL syntax for top expenses
        const expenseQuery = `
            SELECT 
                t.id,
                t.description,
                t.amount,
                t.currency,
                c.name as category_name,
                t.mode,
                t.transaction_date,
                COUNT(*) OVER() as total_count
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = $1
            AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            AND EXTRACT(MONTH FROM t.transaction_date) = $3
            ORDER BY t.amount DESC
            LIMIT $4
        `;
        
        const result = await db.query(expenseQuery, [userId, year, month, limit]);
        
        // ✅ FIXED: Extract rows array
        const expenses = result.rows;
        
        console.log('📊 Top expenses fetched:', expenses.length, 'records');
        
        res.json({
            success: true,
            month: month,
            year: year,
            expenses: expenses
        });
        
    } catch (error) {
        console.error('❌ Error fetching top expenses:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching top expenses',
            error: error.message
        });
    }
});


// ============================================
// GET SPENDING BY MODE
// ============================================

router.get('/spending-by-mode', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/spending-by-mode - User:', req.user.id);
        
        const userId = req.user.id;
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // ✅ FIXED: PostgreSQL syntax for spending by mode
        const modeQuery = `
            SELECT 
                t.mode,
                t.currency,
                COUNT(t.id) as transaction_count,
                SUM(t.amount) as total_amount,
                AVG(t.amount) as average_amount
            FROM transactions t
            WHERE t.user_id = $1
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            AND EXTRACT(MONTH FROM t.transaction_date) = $3
            GROUP BY t.mode, t.currency
            ORDER BY total_amount DESC
        `;
        
        const result = await db.query(modeQuery, [userId, year, month]);
        
        // ✅ FIXED: Extract rows array
        const modeData = result.rows;
        
        console.log('📊 Spending by mode fetched:', modeData.length, 'records');
        
        res.json({
            success: true,
            month: month,
            year: year,
            data: modeData
        });
        
    } catch (error) {
        console.error('❌ Error fetching spending by mode:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching spending by mode',
            error: error.message
        });
    }
});


// ============================================
// GET OVERVIEW DASHBOARD DATA (ALL IN ONE)
// ============================================

router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/dashboard - User:', req.user.id);
        
        const userId = req.user.id;
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // Execute all queries in parallel
        const [
            summaryResult,
            categoryResult,
            trendResult,
            expenseResult,
            modeResult
        ] = await Promise.all([
            // Summary
            db.query(
                `SELECT t.amount, t.mode, t.currency 
                 FROM transactions t 
                 WHERE t.user_id = $1`,
                [userId]
            ),
            
            // Category breakdown
            db.query(
                `SELECT COALESCE(c.name, 'Uncategorized') as category_name, t.currency,
                        COALESCE(SUM(t.amount), 0) as total_amount, COUNT(t.id) as transaction_count
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.user_id = $1 AND t.mode IN ('Expense', 'Credit Card')
                 AND EXTRACT(YEAR FROM t.transaction_date) = $2
                 AND EXTRACT(MONTH FROM t.transaction_date) = $3
                 GROUP BY COALESCE(c.name, 'Uncategorized'), t.currency`,
                [userId, year, month]
            ),
            
            // Monthly trend
            db.query(
                `SELECT EXTRACT(MONTH FROM t.transaction_date) as month, t.currency,
                        SUM(CASE WHEN t.mode = 'Income' THEN t.amount ELSE 0 END) as total_income,
                        SUM(CASE WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') 
                            THEN t.amount ELSE 0 END) as total_expense
                 FROM transactions t
                 WHERE t.user_id = $1 AND EXTRACT(YEAR FROM t.transaction_date) = $2
                 GROUP BY EXTRACT(MONTH FROM t.transaction_date), t.currency`,
                [userId, year]
            ),
            
            // Top expenses
            db.query(
                `SELECT t.id, t.description, t.amount, t.currency, c.name as category_name, t.mode
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.user_id = $1 AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
                 AND EXTRACT(YEAR FROM t.transaction_date) = $2
                 AND EXTRACT(MONTH FROM t.transaction_date) = $3
                 ORDER BY t.amount DESC LIMIT 10`,
                [userId, year, month]
            ),
            
            // Spending by mode
            db.query(
                `SELECT t.mode, t.currency, COUNT(t.id) as transaction_count, SUM(t.amount) as total_amount
                 FROM transactions t
                 WHERE t.user_id = $1 AND EXTRACT(YEAR FROM t.transaction_date) = $2
                 AND EXTRACT(MONTH FROM t.transaction_date) = $3
                 GROUP BY t.mode, t.currency`,
                [userId, year, month]
            )
        ]);
        
        // ✅ FIXED: Extract rows from all results
        const summaryData = summaryResult.rows;
        const categoryData = categoryResult.rows;
        const trendData = trendResult.rows;
        const topExpenses = expenseResult.rows;
        const modeData = modeResult.rows;
        
        console.log('✅ Dashboard data compiled');
        
        res.json({
            success: true,
            month: month,
            year: year,
            summary: summaryData,
            categories: categoryData,
            trend: trendData,
            topExpenses: topExpenses,
            spendingByMode: modeData
        });
        
    } catch (error) {
        console.error('❌ Error fetching dashboard:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard',
            error: error.message
        });
    }
});


module.exports = router;