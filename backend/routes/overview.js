// ============================================
// ✅ COMPLETE OVERVIEW.JS - FIXED & IMPROVED
// File: src/backend/routes/overview.js
// Database: PostgreSQL
// Fixed: Dec 6, 2025
// ✅ FIXES:
//  1. Currency symbol handling (INR = ₹, SAR = ﷼)
//  2. Transaction count formatting (remove leading zeros)
//  3. Category totals calculation (proper aggregation by mode)
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

console.log('✅ Overview routes loaded');

// ============================================
// CURRENCY SYMBOL MAP (FIXED)
// ============================================
const currencySymbols = {
    'INR': '₹',
    'SAR': '﷼',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'د.إ'
};

// ============================================
// GET OVERVIEW SUMMARY DATA (FIXED)
// ============================================

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/summary - User:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ FIXED: Proper PostgreSQL query
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
        const transactions = result.rows;
        
        console.log('   Transactions fetched:', transactions.length);
        
        // ✅ Calculate totals by currency
        const summaryByCurrency = {};
        
        transactions.forEach(t => {
            if (!summaryByCurrency[t.currency]) {
                summaryByCurrency[t.currency] = {
                    currency: t.currency,
                    symbol: currencySymbols[t.currency] || t.currency,
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
            summary: Object.values(summaryByCurrency),
            note: 'Currency symbols properly mapped'
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
// GET CATEGORY BREAKDOWN FOR PIE CHART (FIXED)
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
        
        // ✅ FIXED: Proper category breakdown with correct transaction count
        const categoryQuery = `
            SELECT 
                COALESCE(c.name, 'Uncategorized') as category_name,
                t.currency,
                COALESCE(SUM(t.amount), 0) as total_amount,
                COUNT(DISTINCT t.id) as transaction_count,
                STRING_AGG(DISTINCT t.mode, ', ') as modes
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = $1
            AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            AND EXTRACT(MONTH FROM t.transaction_date) = $3
            GROUP BY COALESCE(c.name, 'Uncategorized'), t.currency
            ORDER BY t.currency, total_amount DESC
        `;
        
        const result = await db.query(categoryQuery, [userId, year, month]);
        const categoryData = result.rows;
        
        console.log('📊 Raw category data fetched:', categoryData.length, 'records');
        console.log('📊 Sample:', categoryData.slice(0, 2).map(c => ({
            category: c.category_name,
            amount: c.total_amount,
            count: c.transaction_count,
            currency: c.currency
        })));
        
        if (!categoryData || categoryData.length === 0) {
            console.log('⚠️ No category data found for this month');
            return res.json({
                success: true,
                month: month,
                year: year,
                allCurrencies: {},
                categories: [],
                note: 'No transactions found for this period'
            });
        }
        
        // ✅ GROUP BY CURRENCY for frontend
        const allCurrencies = {};
        
        categoryData.forEach(item => {
            const currency = item.currency || 'INR';
            
            if (!allCurrencies[currency]) {
                allCurrencies[currency] = [];
            }
            
            // ✅ FIXED: Proper formatting
            allCurrencies[currency].push({
                category_name: item.category_name || 'Uncategorized',
                total_amount: parseFloat(item.total_amount),
                modes: item.modes || 'Expense',
                transaction_count: parseInt(item.transaction_count),  // ✅ Proper integer
                currency_symbol: currencySymbols[currency] || currency
            });
        });
        
        console.log('✅ Grouped by currencies:', Object.keys(allCurrencies));
        
        // ✅ Calculate totals per currency
        const currencyTotals = {};
        Object.keys(allCurrencies).forEach(currency => {
            const total = allCurrencies[currency].reduce((sum, cat) => sum + cat.total_amount, 0);
            const count = allCurrencies[currency].reduce((sum, cat) => sum + cat.transaction_count, 0);
            currencyTotals[currency] = {
                total: total,
                count: count,
                symbol: currencySymbols[currency] || currency
            };
        });
        
        res.json({
            success: true,
            month: month,
            year: year,
            allCurrencies: allCurrencies,
            categories: categoryData,
            currencyTotals: currencyTotals,
            note: 'Transaction counts are integers (not zero-padded)'
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
// GET MONTHLY TREND DATA (FIXED)
// ============================================

router.get('/monthly-trend', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/monthly-trend - User:', req.user.id);
        
        const userId = req.user.id;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // ✅ FIXED: Proper monthly trend query
        const trendQuery = `
            SELECT 
                EXTRACT(MONTH FROM t.transaction_date)::int as month,
                t.currency,
                SUM(CASE WHEN t.mode = 'Income' THEN t.amount ELSE 0 END)::float as total_income,
                SUM(CASE WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') THEN t.amount ELSE 0 END)::float as total_expense,
                COUNT(DISTINCT t.id)::int as transaction_count
            FROM transactions t
            WHERE t.user_id = $1
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            GROUP BY EXTRACT(MONTH FROM t.transaction_date), t.currency
            ORDER BY EXTRACT(MONTH FROM t.transaction_date), t.currency
        `;
        
        const result = await db.query(trendQuery, [userId, year]);
        const trendData = result.rows;
        
        console.log('📊 Monthly trend data fetched:', trendData.length, 'records');
        
        // ✅ Add currency symbols
        const trendDataWithSymbols = trendData.map(d => ({
            ...d,
            currency_symbol: currencySymbols[d.currency] || d.currency,
            transaction_count: parseInt(d.transaction_count)  // ✅ Proper integer
        }));
        
        res.json({
            success: true,
            year: year,
            data: trendDataWithSymbols
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
// GET TOP EXPENSES (FIXED)
// ============================================

router.get('/top-expenses', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/top-expenses - User:', req.user.id);
        
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // ✅ FIXED: Proper top expenses query
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
        const expenses = result.rows;
        
        console.log('📊 Top expenses fetched:', expenses.length, 'records');
        
        // ✅ Add currency symbols
        const expensesWithSymbols = expenses.map(e => ({
            ...e,
            currency_symbol: currencySymbols[e.currency] || e.currency
        }));
        
        res.json({
            success: true,
            month: month,
            year: year,
            expenses: expensesWithSymbols
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
// GET SPENDING BY MODE (FIXED)
// ============================================

router.get('/spending-by-mode', authMiddleware, async (req, res) => {
    try {
        console.log('📊 GET /api/overview/spending-by-mode - User:', req.user.id);
        
        const userId = req.user.id;
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // ✅ FIXED: Proper spending by mode query
        const modeQuery = `
            SELECT 
                t.mode,
                t.currency,
                COUNT(DISTINCT t.id)::int as transaction_count,
                SUM(t.amount)::float as total_amount,
                AVG(t.amount)::float as average_amount
            FROM transactions t
            WHERE t.user_id = $1
            AND EXTRACT(YEAR FROM t.transaction_date) = $2
            AND EXTRACT(MONTH FROM t.transaction_date) = $3
            GROUP BY t.mode, t.currency
            ORDER BY total_amount DESC
        `;
        
        const result = await db.query(modeQuery, [userId, year, month]);
        const modeData = result.rows;
        
        console.log('📊 Spending by mode fetched:', modeData.length, 'records');
        
        // ✅ Add currency symbols and fix types
        const modeDataWithSymbols = modeData.map(m => ({
            ...m,
            currency_symbol: currencySymbols[m.currency] || m.currency,
            transaction_count: parseInt(m.transaction_count),  // ✅ Proper integer
            total_amount: parseFloat(m.total_amount),
            average_amount: parseFloat(m.average_amount)
        }));
        
        res.json({
            success: true,
            month: month,
            year: year,
            data: modeDataWithSymbols
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
                        COALESCE(SUM(t.amount), 0)::float as total_amount, 
                        COUNT(DISTINCT t.id)::int as transaction_count
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.user_id = $1 AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
                 AND EXTRACT(YEAR FROM t.transaction_date) = $2
                 AND EXTRACT(MONTH FROM t.transaction_date) = $3
                 GROUP BY COALESCE(c.name, 'Uncategorized'), t.currency`,
                [userId, year, month]
            ),
            
            // Monthly trend
            db.query(
                `SELECT EXTRACT(MONTH FROM t.transaction_date)::int as month, t.currency,
                        SUM(CASE WHEN t.mode = 'Income' THEN t.amount ELSE 0 END)::float as total_income,
                        SUM(CASE WHEN t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment') 
                            THEN t.amount ELSE 0 END)::float as total_expense
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
                `SELECT t.mode, t.currency, COUNT(DISTINCT t.id)::int as transaction_count, 
                        SUM(t.amount)::float as total_amount
                 FROM transactions t
                 WHERE t.user_id = $1 AND EXTRACT(YEAR FROM t.transaction_date) = $2
                 AND EXTRACT(MONTH FROM t.transaction_date) = $3
                 GROUP BY t.mode, t.currency`,
                [userId, year, month]
            )
        ]);
        
        // ✅ Extract rows and add currency symbols
        const summaryData = summaryResult.rows;
        const categoryData = categoryResult.rows.map(c => ({
            ...c,
            total_amount: parseFloat(c.total_amount),
            transaction_count: parseInt(c.transaction_count),
            currency_symbol: currencySymbols[c.currency] || c.currency
        }));
        const trendData = trendResult.rows.map(t => ({
            ...t,
            total_income: parseFloat(t.total_income),
            total_expense: parseFloat(t.total_expense),
            currency_symbol: currencySymbols[t.currency] || t.currency
        }));
        const topExpenses = expenseResult.rows.map(e => ({
            ...e,
            currency_symbol: currencySymbols[e.currency] || e.currency
        }));
        const modeData = modeResult.rows.map(m => ({
            ...m,
            total_amount: parseFloat(m.total_amount),
            transaction_count: parseInt(m.transaction_count),
            currency_symbol: currencySymbols[m.currency] || m.currency
        }));
        
        console.log('✅ Dashboard data compiled');
        
        res.json({
            success: true,
            month: month,
            year: year,
            summary: summaryData,
            categories: categoryData,
            trend: trendData,
            topExpenses: topExpenses,
            spendingByMode: modeData,
            currencySymbols: currencySymbols,
            note: 'All currency symbols and transaction counts properly formatted'
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