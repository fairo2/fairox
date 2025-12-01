const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

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
        
        const [transactions] = await db.query(transactionQuery, [userId]);
        
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
        console.error('❌ Error fetching overview summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching overview summary',
            error: error.message
        });
    }
});

// ============================================
// GET CATEGORY BREAKDOWN FOR PIE CHART (FIXED FOR PostgreSQL)
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
        
        const [categoryData] = await db.query(categoryQuery, [userId, year, month]);
        
        console.log('📊 Raw category data fetched:', categoryData.length, 'records');
        
        // ✅ GROUP BY CURRENCY for frontend
        const allCurrencies = {};
        
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
        console.error('❌ Error fetching overview category breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching overview category breakdown',
            error: error.message
        });
    }
});

module.exports = router;
