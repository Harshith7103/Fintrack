const express = require('express');
const router = express.Router();
const db = require('../db');

const { checkAndProcessEMIs } = require('../utils/emiHelper');
const { checkAndProcessSavingsEMIs } = require('../utils/savingsEmiHelper');
const { checkAndProcessSalary } = require('../utils/salaryHelper');

// Get dashboard summary for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    // Auto-process EMIs and Savings EMIs before loading dashboard
    try {
        await Promise.all([
            checkAndProcessEMIs(userId),
            checkAndProcessSavingsEMIs(userId),
            checkAndProcessSalary(userId)
        ]);
    } catch (err) {
        console.error("Error processing auto-deductions:", err);
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    // Calculate last Month
    const today = new Date();
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7); // Previous YYYY-MM

    const dashboard = {};

    try {
        // Find the active month (latest with data or current) to show specific stats
        const [[latestMonthResult]] = await db.query(
            `SELECT DATE_FORMAT(Transaction_DateTime, '%Y-%m') as latest_month 
             FROM \`TRANSACTION\` WHERE User_ID = ? 
             ORDER BY Transaction_DateTime DESC LIMIT 1`,
            [userId]
        );
        const activeMonth = latestMonthResult?.latest_month || currentMonth;

        // Execute queries in parallel
        const [
            [summaryRows],    // 1. From Stated Procedure
            [userRows],       // 2. User Profile (Stated Income)
            [lastIncomeResult], // 3. Last Month Income
            [lastExpenseResult], // 4. Last Month Expense
            [recentActivities], // 5. Recent Activities
            [trend],          // 6. Monthly Trend
            [goals],          // 7. Active Savings Goals
            [emis]            // 8. EMIs
        ] = await Promise.all([
            // 1. Get financial summarized data via PL/SQL
            db.query('CALL sp_get_user_financial_summary(?, ?)', [userId, activeMonth]),

            // 2. User Profile (Stated Income)
            db.query('SELECT Monthly_Income FROM USERS WHERE User_ID = ?', [userId]),

            // 3. Last Month Income (For Trend)
            db.query(
                `SELECT COALESCE(SUM(Amount), 0) as amount 
                 FROM \`TRANSACTION\` 
                 WHERE User_ID = ? AND Transaction_Type = 'Income' 
                 AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = ?`,
                [userId, lastMonth]
            ),

            // 4. Last Month Expense (For Trend)
            db.query(
                `SELECT COALESCE(SUM(Amount), 0) as amount 
                 FROM \`TRANSACTION\` 
                 WHERE User_ID = ? AND Transaction_Type = 'Expense' 
                 AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = ?`,
                [userId, lastMonth]
            ),

            // 7. Recent Activities (from Audit Log)
            db.query(
                `SELECT Table_Name, Action_Type, Description, Timestamp as Activity_Time
                 FROM AUDIT_LOG
                 WHERE Changed_By_User_ID = ?
                 ORDER BY Timestamp DESC
                 LIMIT 10`,
                [userId]
            ),

            // 8. Monthly Trend (6 Months)
            db.query(
                `SELECT 
                    DATE_FORMAT(Transaction_DateTime, '%Y-%m') as month,
                    SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END) as income,
                    SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END) as expense
                 FROM \`TRANSACTION\`
                 WHERE User_ID = ?
                 AND Transaction_DateTime >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                 GROUP BY month
                 ORDER BY month`,
                [userId]
            ),

            // 9. Active Savings Goals
            db.query(
                `SELECT * FROM SAVINGS 
                 WHERE User_ID = ? AND Status = 'Active'
                 ORDER BY Target_Date
                 LIMIT 5`,
                [userId]
            ),

            // 10. EMIs for warnings
            db.query(
                `SELECT e.EMI_Title, e.EMI_Amount, e.EMI_Day, a.Account_Name, a.Balance 
                 FROM EMI e 
                 JOIN ACCOUNT a ON e.Account_ID = a.Account_ID 
                 WHERE e.User_ID = ? AND e.Status = 'Active'`,
                [userId]
            )
        ]);

        const calculateTrend = (current, previous) => {
            current = parseFloat(current);
            previous = parseFloat(previous);
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const summaryData = summaryRows[0][0] || {};
        const currentIncome = parseFloat(summaryData.Monthly_Income || 0);
        const currentExpense = parseFloat(summaryData.Monthly_Expense || 0);
        
        const lastIncome = lastIncomeResult.length > 0 ? parseFloat(lastIncomeResult[0].amount) : 0;
        const lastExpense = lastExpenseResult.length > 0 ? parseFloat(lastExpenseResult[0].amount) : 0;

        // Populate dashboard object with query results
        dashboard.total_balance = parseFloat(summaryData.Total_Balance || 0);
        dashboard.stated_income = userRows.length > 0 ? userRows[0].Monthly_Income : 0;
        dashboard.monthly_income = currentIncome;
        dashboard.monthly_expense = currentExpense;
        dashboard.recent_activities = recentActivities;
        dashboard.monthly_trend = trend;
        dashboard.savings_goals = goals;

        // Trends
        dashboard.trends = {
            income: calculateTrend(currentIncome, lastIncome).toFixed(1),
            expense: calculateTrend(currentExpense, lastExpense).toFixed(1),
            balance: 0
        };
        // Estimate balance trend based on net income difference
        const netIncomeCurrent = currentIncome - currentExpense;
        const netIncomeLast = lastIncome - lastExpense;
        // Balance trend is tricky, let's use Net Income trend as proxy for "Wealth Growth Rate"
        dashboard.trends.balance = calculateTrend(netIncomeCurrent, netIncomeLast).toFixed(1);

        const warnings = [];
        const todayDay = new Date().getDate();
        const nextWeek = todayDay + 7;

        emis.forEach(emi => {
            // Check if due in next 7 days (simplified logic)
            const isDueSoon = (emi.EMI_Day >= todayDay && emi.EMI_Day <= nextWeek);

            if (isDueSoon && parseFloat(emi.Balance) < parseFloat(emi.EMI_Amount)) {
                warnings.push({
                    type: 'insufficient_funds',
                    message: `Insufficient funds for EMI "${emi.EMI_Title}" due on day ${emi.EMI_Day} in ${emi.Account_Name}`,
                    amount: emi.EMI_Amount,
                    balance: emi.Balance
                });
            }
        });

        dashboard.warnings = warnings;
        res.json(dashboard);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update dashboard stat manually
router.post('/update-stat', async (req, res) => {
    const { userId, type, value } = req.body;

    if (!userId || !type || value === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0) {
        return res.status(400).json({ error: 'Invalid value' });
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    let connection;

    try {
        if (type === 'income') {
            const [result] = await db.query(
                `SELECT COALESCE(SUM(Amount), 0) as current_income 
                 FROM \`TRANSACTION\` 
                 WHERE User_ID = ? AND Transaction_Type = 'Income' 
                 AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = ?`,
                [userId, currentMonth]
            );

            const currentIncome = result[0].current_income;
            const difference = numericValue - currentIncome;

            if (difference <= 0) {
                return res.status(400).json({ error: 'Cannot reduce income directly. Please delete individual transactions.' });
            }

            // Find an account to add to (or create one)
            let accountId;
            const [accounts] = await db.query(
                'SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? ORDER BY CASE WHEN Account_Type = "Bank" THEN 1 ELSE 2 END LIMIT 1',
                [userId]
            );

            if (accounts.length > 0) {
                accountId = accounts[0].Account_ID;
            } else {
                // Create default Cash account
                const [newAcc] = await db.execute(
                    'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)',
                    [userId, 'Cash Wallet', 'Cash', 0]
                );
                accountId = newAcc.insertId;
            }

            // Add adjustment transaction
            await db.execute(
                `INSERT INTO \`TRANSACTION\` 
                (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime) 
                VALUES (?, ?, ?, 'Income', 'Manual', 'Manual Adjustment', NOW())`,
                [userId, accountId, difference]
            );

            // Update Account Balance (Trigger handles it, but just in case or for immediate consistency if trigger lag)
            // Actually relying on Trigger trg_update_balance_after_transaction is better.

            res.json({ message: 'Income updated with adjustment transaction' });

        } else if (type === 'balance') {
            // Update Account Balance (Prioritize "Cash" or "Bank", or first account)
            const [accounts] = await db.query(
                'SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? ORDER BY CASE WHEN Account_Type = "Cash" THEN 1 ELSE 2 END LIMIT 1',
                [userId]
            );

            if (accounts.length > 0) {
                await db.execute(
                    'UPDATE ACCOUNT SET Balance = ? WHERE Account_ID = ?',
                    [numericValue, accounts[0].Account_ID]
                );
                res.json({ message: 'Balance updated successfully' });
            } else {
                // Create default Cash account
                await db.execute(
                    'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)',
                    [userId, 'Cash Wallet', 'Cash', numericValue]
                );
                res.json({ message: 'Balance updated (New account created)' });
            }

        } else if (type === 'expense') {
            const [result] = await db.query(
                `SELECT COALESCE(SUM(Amount), 0) as current_expense 
                 FROM \`TRANSACTION\` 
                 WHERE User_ID = ? AND Transaction_Type = 'Expense' 
                 AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = ?`,
                [userId, currentMonth]
            );

            const currentExpense = result[0].current_expense;
            const difference = numericValue - currentExpense;

            if (difference <= 0) {
                return res.status(400).json({ error: 'Cannot reduce expense directly. Please delete individual transactions.' });
            }

            // Find an account to deduct from (or create one)
            let accountId;
            const [accounts] = await db.query(
                'SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? LIMIT 1',
                [userId]
            );

            if (accounts.length > 0) {
                accountId = accounts[0].Account_ID;
            } else {
                const [newAcc] = await db.execute(
                    'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)',
                    [userId, 'Cash Wallet', 'Cash', 0]
                );
                accountId = newAcc.insertId;
            }

            // Add adjustment transaction
            await db.execute(
                `INSERT INTO \`TRANSACTION\` 
                (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime) 
                VALUES (?, ?, ?, 'Expense', 'Manual', 'Manual Adjustment', NOW())`,
                [userId, accountId, difference]
            );

            res.json({ message: 'Expense updated with adjustment transaction' });
        } else {
            res.status(400).json({ error: 'Invalid update type' });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
