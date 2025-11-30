const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// ============================================
// EXPORT ALL DATA TO EXCEL
// ============================================
router.get('/excel', authMiddleware, async (req, res) => {
    try {
        console.log('📥 Exporting data for user:', req.user.id);
        
        const userId = req.user.id;
        
        // ✅ Fetch all transactions
        const transactionsQuery = `
            SELECT 
                t.id,
                DATE_FORMAT(t.transaction_date, '%d-%m-%Y') as date,
                ac.name as account_name,
                c.name as category_name,
                t.description,
                t.amount,
                t.currency,
                t.mode
            FROM transactions t
            LEFT JOIN accounts ac ON t.account_id = ac.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = ?
            ORDER BY t.transaction_date DESC
        `;
        
        const [transactions] = await db.query(transactionsQuery, [userId]);
        console.log('✅ Fetched transactions:', transactions.length);
        
        // ✅ Fetch all budget limits
        const budgetQuery = `
            SELECT 
                bl.id,
                c.name as category_name,
                bl.currency,
                bl.monthly_limit,
                bl.alert_threshold,
                DATE_FORMAT(bl.created_at, '%d-%m-%Y') as created_date
            FROM budget_limits bl
            LEFT JOIN categories c ON bl.category_id = c.id
            WHERE bl.user_id = ?
        `;
        
        const [budgets] = await db.query(budgetQuery, [userId]);
        console.log('✅ Fetched budgets:', budgets.length);
        
        // ✅ Fetch recurring transactions
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
                DATE_FORMAT(rt.start_date, '%d-%m-%Y') as start_date,
                DATE_FORMAT(rt.end_date, '%d-%m-%Y') as end_date
            FROM recurring_transactions rt
            LEFT JOIN accounts ac ON rt.account_id = ac.id
            LEFT JOIN categories c ON rt.category_id = c.id
            WHERE rt.user_id = ?
        `;
        
        const [recurring] = await db.query(recurringQuery, [userId]);
        console.log('✅ Fetched recurring:', recurring.length);
        
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
        
        // Add header styling
        txnSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        txnSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B8D4' } };
        
        // Add data
        transactions.forEach(t => {
            txnSheet.addRow(t);
        });
        
        // Format amount column
        txnSheet.getColumn('amount').numFmt = '#,##0.00';
        
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
        
        // Add header styling
        budgetSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        budgetSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FF4CAF50' };
        
        // Add data
        budgets.forEach(b => {
            budgetSheet.addRow(b);
        });
        
        // Format amount column
        budgetSheet.getColumn('monthly_limit').numFmt = '#,##0.00';
        
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
        
        // Add header styling
        recurringSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        recurringSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FF2196F3' };
        
        // Add data
        recurring.forEach(r => {
            recurringSheet.addRow(r);
        });
        
        // Format amount column
        recurringSheet.getColumn('amount').numFmt = '#,##0.00';
        
        // ============================================
        // SHEET 4: SUMMARY
        // ============================================
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 20 }
        ];
        
        // Add header styling
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FFFF9800' };
        
        // Calculate totals
        const totalTransactions = transactions.length;
        const totalExpense = transactions
            .filter(t => t.mode === 'Expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0)
            .toFixed(2);
        const totalIncome = transactions
            .filter(t => t.mode === 'Income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0)
            .toFixed(2);
        
        summarySheet.addRow({ metric: 'Total Transactions', value: totalTransactions });
        summarySheet.addRow({ metric: 'Total Expenses', value: totalExpense });
        summarySheet.addRow({ metric: 'Total Income', value: totalIncome });
        summarySheet.addRow({ metric: 'Net (Income - Expense)', value: (totalIncome - totalExpense).toFixed(2) });
        summarySheet.addRow({ metric: 'Active Budget Limits', value: budgets.length });
        summarySheet.addRow({ metric: 'Active Recurring Transactions', value: recurring.length });
        summarySheet.addRow({ metric: 'Export Date', value: new Date().toLocaleString() });
        
        // Format numbers
        summarySheet.getColumn('value').numFmt = '#,##0.00';
        
        // ============================================
        // SEND FILE
        // ============================================
        const fileName = `PFMS_Export_${new Date().toISOString().split('T')}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        await workbook.xlsx.write(res);
        
        console.log('✅ Excel exported successfully');
        
    } catch (error) {
        console.error('❌ Export error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting data',
            error: error.message
        });
    }
});

module.exports = router;
