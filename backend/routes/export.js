// ============================================
// ✅ COMPLETE EXPORT.JS - PRODUCTION READY
// File: src/backend/routes/export.js
// Database: PostgreSQL
// Fixed: Dec 1, 2025
// ============================================

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

console.log('✅ Export routes loaded');


// ============================================
// EXPORT ALL DATA TO EXCEL (GET /api/export/excel)
// ============================================

router.get('/excel', authMiddleware, async (req, res) => {
    try {
        console.log('📥 GET /api/export/excel - Exporting data for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ FIXED: PostgreSQL syntax - use TO_CHAR for date formatting
        const transactionsQuery = `
            SELECT 
                t.id,
                TO_CHAR(t.transaction_date, 'DD-MM-YYYY') as date,
                ac.name as account_name,
                c.name as category_name,
                t.description,
                t.amount,
                t.currency,
                t.mode
            FROM transactions t
            LEFT JOIN accounts ac ON t.account_id = ac.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = $1
            ORDER BY t.transaction_date DESC
        `;
        
        const transactionsResult = await db.query(transactionsQuery, [userId]);
        // ✅ FIXED: Extract rows array from result
        const transactions = transactionsResult.rows;
        console.log('✅ Fetched transactions:', transactions.length);
        
        // ✅ FIXED: PostgreSQL syntax - use TO_CHAR for date formatting
        const budgetQuery = `
            SELECT 
                bl.id,
                c.name as category_name,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                TO_CHAR(bl.created_at, 'DD-MM-YYYY') as created_date
            FROM budget_limits bl
            LEFT JOIN categories c ON bl.category_id = c.id
            WHERE bl.user_id = $1
        `;
        
        const budgetsResult = await db.query(budgetQuery, [userId]);
        // ✅ FIXED: Extract rows array from result
        const budgets = budgetsResult.rows;
        console.log('✅ Fetched budgets:', budgets.length);
        
        // ✅ FIXED: PostgreSQL syntax - use TO_CHAR for date formatting
        const recurringQuery = `
            SELECT 
                rt.id,
                ac.name as account_name,
                c.name as category_name,
                rt.description,
                rt.amount,
                rt.currency,
                rt.frequency,
                rt.mode,
                TO_CHAR(rt.start_date, 'DD-MM-YYYY') as start_date,
                TO_CHAR(rt.end_date, 'DD-MM-YYYY') as end_date
            FROM recurring_transactions rt
            LEFT JOIN accounts ac ON rt.account_id = ac.id
            LEFT JOIN categories c ON rt.category_id = c.id
            WHERE rt.user_id = $1
        `;
        
        const recurringResult = await db.query(recurringQuery, [userId]);
        // ✅ FIXED: Extract rows array from result
        const recurring = recurringResult.rows;
        console.log('✅ Fetched recurring transactions:', recurring.length);
        
        // ✅ Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        
        // ============================================
        // SHEET 1: TRANSACTIONS
        // ============================================
        const txnSheet = workbook.addWorksheet('Transactions');
        txnSheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Account', key: 'account_name', width: 15 },
            { header: 'Category', key: 'category_name', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Amount', key: 'amount', width: 12 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Mode', key: 'mode', width: 10 }
        ];
        
        // ✅ Add header styling
        txnSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        txnSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B8D4' } };
        
        // ✅ Add data rows
        transactions.forEach(t => {
            txnSheet.addRow(t);
        });
        
        // ✅ Format amount column as currency
        txnSheet.getColumn('amount').numFmt = '#,##0.00';
        
        console.log('✅ Transactions sheet created');
        
        // ============================================
        // SHEET 2: BUDGET LIMITS
        // ============================================
        const budgetSheet = workbook.addWorksheet('Budget Limits');
        budgetSheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Category', key: 'category_name', width: 20 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Monthly Limit', key: 'monthly_limit', width: 15 },
            { header: 'Alert Threshold (%)', key: 'alert_threshold', width: 18 },
            { header: 'Created Date', key: 'created_date', width: 15 }
        ];
        
        // ✅ Add header styling
        budgetSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        budgetSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
        
        // ✅ Add data rows
        budgets.forEach(b => {
            budgetSheet.addRow(b);
        });
        
        // ✅ Format amount column as currency
        budgetSheet.getColumn('monthly_limit').numFmt = '#,##0.00';
        
        console.log('✅ Budget Limits sheet created');
        
        // ============================================
        // SHEET 3: RECURRING TRANSACTIONS
        // ============================================
        const recurringSheet = workbook.addWorksheet('Recurring Transactions');
        recurringSheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Account', key: 'account_name', width: 15 },
            { header: 'Category', key: 'category_name', width: 15 },
            { header: 'Description', key: 'description', width: 25 },
            { header: 'Amount', key: 'amount', width: 12 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Frequency', key: 'frequency', width: 12 },
            { header: 'Mode', key: 'mode', width: 10 },
            { header: 'Start Date', key: 'start_date', width: 15 },
            { header: 'End Date', key: 'end_date', width: 15 }
        ];
        
        // ✅ Add header styling
        recurringSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        recurringSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2196F3' } };
        
        // ✅ Add data rows
        recurring.forEach(r => {
            recurringSheet.addRow(r);
        });
        
        // ✅ Format amount column as currency
        recurringSheet.getColumn('amount').numFmt = '#,##0.00';
        
        console.log('✅ Recurring Transactions sheet created');
        
        // ============================================
        // SHEET 4: SUMMARY
        // ============================================
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 20 }
        ];
        
        // ✅ Add header styling
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9800' } };
        
        // ✅ Calculate totals - handle empty arrays and parse floats safely
        const totalTransactions = transactions.length;
        
        const totalExpense = transactions
            .filter(t => t.mode === 'Expense')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
            .toFixed(2);
        
        const totalIncome = transactions
            .filter(t => t.mode === 'Income')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
            .toFixed(2);
        
        const netBalance = (parseFloat(totalIncome) - parseFloat(totalExpense)).toFixed(2);
        
        // ✅ Add summary rows
        summarySheet.addRow({ metric: 'Total Transactions', value: totalTransactions });
        summarySheet.addRow({ metric: 'Total Expenses', value: totalExpense });
        summarySheet.addRow({ metric: 'Total Income', value: totalIncome });
        summarySheet.addRow({ metric: 'Net (Income - Expense)', value: netBalance });
        summarySheet.addRow({ metric: 'Active Budget Limits', value: budgets.length });
        summarySheet.addRow({ metric: 'Active Recurring Transactions', value: recurring.length });
        summarySheet.addRow({ metric: 'Export Date', value: new Date().toLocaleString() });
        
        // ✅ Format numbers as currency
        summarySheet.getColumn('value').numFmt = '#,##0.00';
        
        console.log('✅ Summary sheet created');
        
        // ============================================
        // SEND FILE
        // ============================================
        const fileName = `PFMS_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        console.log('📄 Preparing to send file:', fileName);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        await workbook.xlsx.write(res);
        
        console.log('✅ Excel file exported successfully:', fileName);
        
    } catch (error) {
        console.error('❌ Export error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error exporting data',
            error: error.message
        });
    }
});


// ============================================
// EXPORT TRANSACTIONS TO EXCEL (GET /api/export/transactions)
// ============================================

router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        console.log('📥 GET /api/export/transactions - Exporting transactions for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ FIXED: PostgreSQL syntax
        const query = `
            SELECT 
                t.id,
                TO_CHAR(t.transaction_date, 'DD-MM-YYYY') as date,
                ac.name as account_name,
                c.name as category_name,
                t.description,
                t.amount,
                t.currency,
                t.mode
            FROM transactions t
            LEFT JOIN accounts ac ON t.account_id = ac.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = $1
            ORDER BY t.transaction_date DESC
        `;
        
        const result = await db.query(query, [userId]);
        // ✅ FIXED: Extract rows array from result
        const transactions = result.rows;
        
        console.log('✅ Fetched transactions:', transactions.length);
        
        // ✅ Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Transactions');
        
        sheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Account', key: 'account_name', width: 15 },
            { header: 'Category', key: 'category_name', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Amount', key: 'amount', width: 12 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Mode', key: 'mode', width: 10 }
        ];
        
        // ✅ Add header styling
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B8D4' } };
        
        // ✅ Add data
        transactions.forEach(t => {
            sheet.addRow(t);
        });
        
        // ✅ Format amount column
        sheet.getColumn('amount').numFmt = '#,##0.00';
        
        const fileName = `PFMS_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        await workbook.xlsx.write(res);
        
        console.log('✅ Transactions exported successfully');
        
    } catch (error) {
        console.error('❌ Export transactions error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error exporting transactions',
            error: error.message
        });
    }
});


// ============================================
// EXPORT BUDGETS TO EXCEL (GET /api/export/budgets)
// ============================================

router.get('/budgets', authMiddleware, async (req, res) => {
    try {
        console.log('📥 GET /api/export/budgets - Exporting budgets for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ FIXED: PostgreSQL syntax with proper aggregate function
        const query = `
            SELECT 
                bl.id,
                c.name as category_name,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                COALESCE(SUM(t.amount), 0) as current_spending,
                ROUND((COALESCE(SUM(t.amount), 0)::NUMERIC / bl.monthly_limit::NUMERIC) * 100, 2) as percentage_used,
                TO_CHAR(bl.created_at, 'DD-MM-YYYY') as created_date
            FROM budget_limits bl
            LEFT JOIN categories c ON bl.category_id = c.id
            LEFT JOIN transactions t ON t.category_id = bl.category_id 
                AND t.user_id = bl.user_id 
                AND t.currency = bl.currency
                AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND t.mode IN ('Expense', 'Credit Card', 'Debit Card', 'Cash Payment')
            WHERE bl.user_id = $1
            GROUP BY bl.id, bl.user_id, bl.category_id, bl.currency, bl.monthly_limit, bl.alert_threshold, c.name, bl.created_at
        `;
        
        const result = await db.query(query, [userId]);
        // ✅ FIXED: Extract rows array from result
        const budgets = result.rows;
        
        console.log('✅ Fetched budgets:', budgets.length);
        
        // ✅ Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Budgets');
        
        sheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Category', key: 'category_name', width: 20 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Monthly Limit', key: 'monthly_limit', width: 15 },
            { header: 'Current Spending', key: 'current_spending', width: 18 },
            { header: 'Used (%)', key: 'percentage_used', width: 12 },
            { header: 'Alert Threshold (%)', key: 'alert_threshold', width: 18 },
            { header: 'Created Date', key: 'created_date', width: 15 }
        ];
        
        // ✅ Add header styling
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
        
        // ✅ Add data
        budgets.forEach(b => {
            sheet.addRow({
                ...b,
                monthly_limit: parseFloat(b.monthly_limit) || 0,
                current_spending: parseFloat(b.current_spending) || 0,
                percentage_used: parseFloat(b.percentage_used) || 0,
                alert_threshold: parseFloat(b.alert_threshold) || 0
            });
        });
        
        // ✅ Format currency columns
        sheet.getColumn('monthly_limit').numFmt = '#,##0.00';
        sheet.getColumn('current_spending').numFmt = '#,##0.00';
        sheet.getColumn('percentage_used').numFmt = '0.00"%"';
        
        const fileName = `PFMS_Budgets_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        await workbook.xlsx.write(res);
        
        console.log('✅ Budgets exported successfully');
        
    } catch (error) {
        console.error('❌ Export budgets error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error exporting budgets',
            error: error.message
        });
    }
});


module.exports = router;