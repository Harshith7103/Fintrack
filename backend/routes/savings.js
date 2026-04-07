const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncProjectData } = require('../utils/syncHelper');

function formatDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
        const d = new Date(`${parts[2]}-${parts[Part1]}-${parts[0]}`); // Wait, parts[Part1]? Error here!
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

// Fixed formatDate
function formatDateFixed(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

// Get all savings goals for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [goals] = await db.query(
            `SELECT s.*, a.Account_Name, a.Balance as Account_Balance
             FROM SAVINGS s
             LEFT JOIN ACCOUNT a ON s.Account_ID = a.Account_ID
             WHERE s.User_ID = ? 
             ORDER BY FIELD(s.Status, 'Active', 'Achieved'), s.Target_Date`,
            [userId]
        );

        // --- UNIVERSAL AUTO-SYNC ---
        syncProjectData(userId).catch(e => console.error('Goal Sync Error:', e.message));

        res.json(goals);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create new savings goal
router.post('/', async (req, res) => {
    const { user_id, goal_title, target_amount, current_amount, start_date, target_date, emi_enabled, emi_amount, emi_date, account_id } = req.body;
    if (!user_id || !goal_title || !target_amount) return res.status(400).json({ error: 'Missing required fields' });

    const formattedStartDate = formatDateFixed(start_date) || new Date().toISOString().split('T')[0];
    const formattedTargetDate = formatDateFixed(target_date);

    try {
        const [result] = await db.execute(
            `INSERT INTO SAVINGS (User_ID, Goal_Title, Target_Amount, Current_Amount, Start_Date, Target_Date, Status, EMI_Enabled, EMI_Amount, EMI_Date, Account_ID)
             VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
            [user_id, goal_title, parseFloat(target_amount), parseFloat(current_amount) || 0, formattedStartDate, formattedTargetDate, !!emi_enabled, emi_enabled ? parseFloat(emi_amount) : null, emi_enabled ? parseInt(emi_date) : null, emi_enabled ? parseInt(account_id) : null]
        );

        // SYNC
        syncProjectData(user_id).catch(e => console.error('Goal Sync Error:', e.message));

        res.json({ message: 'Savings goal created successfully', goal_id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update savings goal
router.put('/:goalId', async (req, res) => {
    const { goalId } = req.params;
    const { user_id, goal_title, target_amount, current_amount, start_date, target_date, emi_enabled, emi_amount, emi_date, account_id } = req.body;

    try {
        const formattedStartDate = formatDateFixed(start_date) || new Date().toISOString().split('T')[0];
        const formattedTargetDate = formatDateFixed(target_date);

        await db.execute(
            `UPDATE SAVINGS SET
                Goal_Title = ?, Target_Amount = ?, Current_Amount = ?,
                Start_Date = ?, Target_Date = ?,
                EMI_Enabled = ?, EMI_Amount = ?, EMI_Date = ?, Account_ID = ?
             WHERE Goal_ID = ? AND User_ID = ?`,
            [
                goal_title,
                parseFloat(target_amount),
                parseFloat(current_amount) || 0,
                formattedStartDate,
                formattedTargetDate,
                !!emi_enabled,
                emi_enabled ? parseFloat(emi_amount) : null,
                emi_enabled ? parseInt(emi_date) : null,
                emi_enabled ? parseInt(account_id) : null,
                goalId,
                user_id
            ]
        );

        syncProjectData(user_id).catch(e => console.error('Goal Sync Error:', e.message));
        res.json({ message: 'Savings goal updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contribute to a savings goal (manual payment)
router.post('/:goalId/contribute', async (req, res) => {
    const { goalId } = req.params;
    const { amount, account_id } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!account_id) {
        return res.status(400).json({ error: 'account_id is required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Validate goal exists
        const [goalRows] = await connection.execute(
            'SELECT * FROM SAVINGS WHERE Goal_ID = ? FOR UPDATE',
            [goalId]
        );
        if (!goalRows.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Savings goal not found' });
        }
        const goal = goalRows[0];

        if (goal.Status === 'Achieved') {
            await connection.rollback();
            return res.status(400).json({ error: 'This goal is already achieved' });
        }

        const amt = parseFloat(amount);
        const remaining = parseFloat(goal.Target_Amount) - parseFloat(goal.Current_Amount);
        if (amt > remaining) {
            await connection.rollback();
            return res.status(400).json({ error: `Amount exceeds remaining goal (₹${remaining.toLocaleString()})` });
        }

        // 2. Validate account balance
        const [accRows] = await connection.execute(
            'SELECT Balance FROM ACCOUNT WHERE Account_ID = ? AND User_ID = ? FOR UPDATE',
            [account_id, goal.User_ID]
        );
        if (!accRows.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Account not found or does not belong to this user' });
        }
        if (parseFloat(accRows[0].Balance) < amt) {
            await connection.rollback();
            return res.status(400).json({ error: `Insufficient balance. Available: ₹${parseFloat(accRows[0].Balance).toLocaleString()}` });
        }

        // 3. Deduct from account via transaction (trigger updates balance)
        await connection.execute(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
             VALUES (?, ?, ?, 'Expense', 'Manual', ?, NOW())`,
            [goal.User_ID, account_id, amt, `Savings: ${goal.Goal_Title}`]
        );

        // 4. Update savings goal current amount
        const newAmount = parseFloat(goal.Current_Amount) + amt;
        const newStatus = newAmount >= parseFloat(goal.Target_Amount) ? 'Achieved' : 'Active';
        await connection.execute(
            'UPDATE SAVINGS SET Current_Amount = ?, Status = ? WHERE Goal_ID = ?',
            [newAmount, newStatus, goalId]
        );

        // 5. Log in savings_emi_history
        await connection.execute(
            'INSERT INTO SAVINGS_EMI_HISTORY (Goal_ID, Amount, Account_ID, Status) VALUES (?, ?, ?, ?)',
            [goalId, amt, account_id, 'Success']
        );

        await connection.commit();

        syncProjectData(goal.User_ID).catch(e => console.error('Goal Sync Error:', e.message));

        res.json({
            message: newStatus === 'Achieved' ? '🎉 Goal achieved!' : 'Contribution added successfully',
            new_amount: newAmount,
            status: newStatus
        });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Get EMI history for a savings goal
router.get('/:goalId/emi-history', async (req, res) => {
    const { goalId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT h.*, a.Account_Name,
                    h.Amount as EMI_Amount
             FROM SAVINGS_EMI_HISTORY h
             LEFT JOIN ACCOUNT a ON h.Account_ID = a.Account_ID
             WHERE h.Goal_ID = ?
             ORDER BY h.Deduction_Date DESC
             LIMIT 50`,
            [goalId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete savings goal
router.delete('/:goalId', async (req, res) => {
    const { goalId } = req.params;
    try {
        const [rows] = await db.query('SELECT User_ID FROM SAVINGS WHERE Goal_ID = ?', [goalId]);
        if (rows[0]) {
            await db.execute('DELETE FROM SAVINGS WHERE Goal_ID = ?', [goalId]);
            syncProjectData(rows[0].User_ID).catch(e => console.error('Goal Sync Error:', e.message));
        }
        res.json({ message: 'Savings goal deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
