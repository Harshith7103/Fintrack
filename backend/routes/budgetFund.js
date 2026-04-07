const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncProjectData } = require('../utils/syncHelper');

// ==========================================
//   HELPER: Block operations on deleted budgets
// ==========================================
const checkBudgetActive = (budget) => {
    if (!budget) return { ok: false, msg: 'Budget not found' };
    if (budget.Status === 'Deleted') return { ok: false, msg: 'This budget has been deleted. No further operations allowed.' };
    return { ok: true };
};

// ==========================================
//   GET ALL BUDGETS (for a user)
// ==========================================
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [budgets] = await db.query(
            `SELECT b.*, a.Account_Name, a.Balance AS Account_Balance
             FROM BUDGET_V2 b
             JOIN ACCOUNT a ON b.Source_Account_ID = a.Account_ID
             WHERE b.User_ID = ?
             ORDER BY FIELD(b.Status, 'Active', 'Completed', 'Deleted'), b.Created_At DESC`,
            [userId]
        );

        for (const budget of budgets) {
            const [events] = await db.query(
                'SELECT * FROM BUDGET_EVENTS WHERE Budget_ID = ? ORDER BY Created_At',
                [budget.Budget_ID]
            );
            budget.events = events;

            const totalAllocated = events.reduce((s, e) => s + parseFloat(e.Allocated_Amount), 0);
            budget.Unallocated_Amount = parseFloat(budget.Total_Budget_Amount) - totalAllocated;
        }

        // --- AUTO-SYNC ---
        syncProjectData(userId).catch(e => console.error('Budget Auto-Sync Error:', e.message));

        res.json(budgets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
//   GET SINGLE BUDGET DETAIL
// ==========================================
router.get('/detail/:budgetId', async (req, res) => {
    const { budgetId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT b.*, a.Account_Name, a.Balance AS Account_Balance
             FROM BUDGET_V2 b
             JOIN ACCOUNT a ON b.Source_Account_ID = a.Account_ID
             WHERE b.Budget_ID = ?`,
            [budgetId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Budget not found' });

        const budget = rows[0];
        const [events] = await db.query(
            'SELECT * FROM BUDGET_EVENTS WHERE Budget_ID = ? ORDER BY Created_At',
            [budgetId]
        );
        budget.events = events;

        const totalAllocated = events.reduce((s, e) => s + parseFloat(e.Allocated_Amount), 0);
        budget.Unallocated_Amount = parseFloat(budget.Total_Budget_Amount) - totalAllocated;

        res.json(budget);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
//   STEP 1: CREATE BUDGET
// ==========================================
router.post('/create', async (req, res) => {
    const { userId, budgetName, budgetAmount, sourceAccountId } = req.body;

    if (!userId || !budgetName || !budgetAmount || !sourceAccountId) {
        return res.status(400).json({ error: 'All fields are required: budgetName, budgetAmount, sourceAccountId' });
    }

    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Budget amount must be a positive number' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Validate account balance
        const [accRows] = await connection.execute(
            'SELECT Balance FROM ACCOUNT WHERE Account_ID = ? FOR UPDATE',
            [sourceAccountId]
        );
        if (accRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Source account not found' });
        }
        if (parseFloat(accRows[0].Balance) < amount) {
            await connection.rollback();
            return res.status(400).json({ error: `Insufficient account balance. Available: ₹${parseFloat(accRows[0].Balance).toLocaleString()}` });
        }

        // 2. Log Transaction (trigger auto-deducts from account)
        await connection.execute(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
             VALUES (?, ?, ?, 'Expense', 'Transfer', ?, NOW())`,
            [userId, sourceAccountId, amount, `Budget Created: ${budgetName}`]
        );

        // 3. Create Budget
        const [result] = await connection.execute(
            `INSERT INTO BUDGET_V2 (User_ID, Budget_Name, Initial_Budget_Amount, Total_Budget_Amount, Remaining_Budget_Amount, Source_Account_ID, Status)
             VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
            [userId, budgetName, amount, amount, amount, sourceAccountId]
        );
        const budgetId = result.insertId;

        // 4. Log Budget Transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Description)
             VALUES (?, 'CREATE', ?, 0, ?, ?)`,
            [budgetId, amount, amount, `Budget "${budgetName}" created with ₹${amount}`]
        );

        await connection.commit();
        
        syncProjectData(userId).catch(e => console.error('Budget Sync:', e));
        
        res.json({ message: 'Budget created successfully', budgetId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error creating budget:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 2: ADD EVENT (ALLOCATE)
// ==========================================
router.post('/event', async (req, res) => {
    const { budgetId, eventName, allocatedAmount } = req.body;

    if (!budgetId || !eventName || !allocatedAmount) {
        return res.status(400).json({ error: 'All fields required: eventName, allocatedAmount' });
    }

    const amount = parseFloat(allocatedAmount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Allocation amount must be positive' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get & validate budget
        const [budgetRows] = await connection.execute(
            'SELECT * FROM BUDGET_V2 WHERE Budget_ID = ? FOR UPDATE', [budgetId]
        );
        if (budgetRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Budget not found' }); }
        const budget = budgetRows[0];

        const check = checkBudgetActive(budget);
        if (!check.ok) { await connection.rollback(); return res.status(400).json({ error: check.msg }); }

        // 2. Check unallocated amount
        const [eventSum] = await connection.execute(
            'SELECT COALESCE(SUM(Allocated_Amount), 0) AS total_allocated FROM BUDGET_EVENTS WHERE Budget_ID = ?',
            [budgetId]
        );
        const currentAllocated = parseFloat(eventSum[0].total_allocated);
        const unallocated = parseFloat(budget.Total_Budget_Amount) - currentAllocated;

        if (amount > unallocated) {
            await connection.rollback();
            return res.status(400).json({ error: `Allocation exceeds unallocated budget. Available: ₹${unallocated.toFixed(2)}` });
        }

        // 3. Create Event
        const [eventResult] = await connection.execute(
            `INSERT INTO BUDGET_EVENTS (Budget_ID, Event_Name, Allocated_Amount, Remaining_Event_Amount)
             VALUES (?, ?, ?, ?)`,
            [budgetId, eventName, amount, amount]
        );

        // 4. Log Transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Event_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Previous_Event_Balance, New_Event_Balance, Description)
             VALUES (?, ?, 'ALLOCATE', ?, ?, ?, 0, ?, ?)`,
            [budgetId, eventResult.insertId, amount, budget.Remaining_Budget_Amount, budget.Remaining_Budget_Amount, amount, `Allocated ₹${amount} to "${eventName}"`]
        );

        await connection.commit();

        syncProjectData(budget.User_ID).catch(e => console.error('Budget Sync:', e));

        res.json({ message: 'Event added successfully', eventId: eventResult.insertId });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 3: SPEND MONEY
// ==========================================
router.post('/spend', async (req, res) => {
    const { budgetId, eventId, amount, description } = req.body;

    if (!budgetId || !eventId || !amount) {
        return res.status(400).json({ error: 'All fields required: eventId, amount' });
    }

    const spendAmt = parseFloat(amount);
    if (isNaN(spendAmt) || spendAmt <= 0) return res.status(400).json({ error: 'Spend amount must be positive' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get & validate budget
        const [budgetRows] = await connection.execute(
            'SELECT * FROM BUDGET_V2 WHERE Budget_ID = ? FOR UPDATE', [budgetId]
        );
        if (budgetRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Budget not found' }); }
        const budget = budgetRows[0];

        const check = checkBudgetActive(budget);
        if (!check.ok) { await connection.rollback(); return res.status(400).json({ error: check.msg }); }

        // 2. Get & validate event
        const [eventRows] = await connection.execute(
            'SELECT * FROM BUDGET_EVENTS WHERE Event_ID = ? AND Budget_ID = ? FOR UPDATE', [eventId, budgetId]
        );
        if (eventRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Event not found in this budget' }); }
        const event = eventRows[0];

        let eventRemaining = parseFloat(event.Remaining_Event_Amount);
        const budgetRemaining = parseFloat(budget.Remaining_Budget_Amount);

        // 3. Smart Reallocation: If event balance is insufficient, pull from unallocated pool
        if (spendAmt > eventRemaining) {
            // Calculate current unallocated
            const [allocSum] = await connection.execute(
                'SELECT COALESCE(SUM(Allocated_Amount), 0) AS total FROM BUDGET_EVENTS WHERE Budget_ID = ?', 
                [budgetId]
            );
            const unallocated = parseFloat(budget.Total_Budget_Amount) - parseFloat(allocSum[0].total);
            const diffNeeded = spendAmt - eventRemaining;

            if (diffNeeded > 0 && diffNeeded <= unallocated) {
                // Auto-reallocate the difference from the general fund to this event
                await connection.execute(
                    'UPDATE BUDGET_EVENTS SET Allocated_Amount = Allocated_Amount + ?, Remaining_Event_Amount = Remaining_Event_Amount + ? WHERE Event_ID = ?',
                    [diffNeeded, diffNeeded, eventId]
                );
                
                // Log the auto-reallocation for transparency
                await connection.execute(
                    `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Event_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Previous_Event_Balance, New_Event_Balance, Description)
                     VALUES (?, ?, 'REALLOCATE', ?, ?, ?, ?, ?, ?)`,
                    [budgetId, eventId, diffNeeded, budgetRemaining, budgetRemaining, eventRemaining, eventRemaining + diffNeeded, `Auto-allocated ₹${diffNeeded} from general fund to cover expense`]
                );

                // Update locals for the spend logic below
                eventRemaining = spendAmt;
            } else {
                await connection.rollback();
                return res.status(400).json({ 
                    error: `Insufficient funds. This event has ₹${eventRemaining.toFixed(2)} and the general fund only has ₹${unallocated.toFixed(2)}.` 
                });
            }
        }

        if (spendAmt > budgetRemaining) {
            await connection.rollback();
            return res.status(400).json({ error: `Insufficient budget balance. Total available: ₹${budgetRemaining.toFixed(2)}` });
        }

        const newEventRemaining = eventRemaining - spendAmt;
        const newBudgetRemaining = budgetRemaining - spendAmt;
        const newStatus = newBudgetRemaining <= 0 ? 'Completed' : 'Active';

        // 4. Deduct from Event
        await connection.execute(
            'UPDATE BUDGET_EVENTS SET Remaining_Event_Amount = ? WHERE Event_ID = ?',
            [newEventRemaining, eventId]
        );

        // 5. Deduct from Budget
        await connection.execute(
            'UPDATE BUDGET_V2 SET Remaining_Budget_Amount = ?, Status = ? WHERE Budget_ID = ?',
            [newBudgetRemaining, newStatus, budgetId]
        );

        // 6. Log Budget Transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Event_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Previous_Event_Balance, New_Event_Balance, Description)
             VALUES (?, ?, 'SPEND', ?, ?, ?, ?, ?, ?)`,
            [budgetId, eventId, spendAmt, budgetRemaining, newBudgetRemaining, eventRemaining, newEventRemaining,
                description || `Spent ₹${spendAmt} from "${event.Event_Name}"`]
        );

        await connection.commit();

        syncProjectData(budget.User_ID).catch(e => console.error('Budget Sync:', e));

        res.json({ message: 'Expense recorded', newBudgetRemaining, newEventRemaining, status: newStatus });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 4: INCREASE BUDGET
// ==========================================
router.post('/increase', async (req, res) => {
    const { budgetId, increaseAmount } = req.body;

    if (!budgetId || !increaseAmount) {
        return res.status(400).json({ error: 'Budget ID and increase amount are required' });
    }

    const amount = parseFloat(increaseAmount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Increase amount must be positive' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get & validate budget
        const [budgetRows] = await connection.execute(
            'SELECT * FROM BUDGET_V2 WHERE Budget_ID = ? FOR UPDATE', [budgetId]
        );
        if (budgetRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Budget not found' }); }
        const budget = budgetRows[0];

        const check = checkBudgetActive(budget);
        if (!check.ok) { await connection.rollback(); return res.status(400).json({ error: check.msg }); }

        // 2. Validate account balance
        const [accRows] = await connection.execute(
            'SELECT Balance FROM ACCOUNT WHERE Account_ID = ? FOR UPDATE', [budget.Source_Account_ID]
        );
        if (parseFloat(accRows[0].Balance) < amount) {
            await connection.rollback();
            return res.status(400).json({ error: `Insufficient account balance. Available: ₹${parseFloat(accRows[0].Balance).toLocaleString()}` });
        }

        const prevRemaining = parseFloat(budget.Remaining_Budget_Amount);
        const newTotal = parseFloat(budget.Total_Budget_Amount) + amount;
        const newRemaining = prevRemaining + amount;

        // 3. Log main transaction (trigger auto-deducts from account)
        await connection.execute(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
             VALUES (?, ?, ?, 'Expense', 'Transfer', ?, NOW())`,
            [budget.User_ID, budget.Source_Account_ID, amount, `Budget Increase: ${budget.Budget_Name}`]
        );

        // 4. Update Budget — increased amount stays UNALLOCATED
        await connection.execute(
            'UPDATE BUDGET_V2 SET Total_Budget_Amount = ?, Remaining_Budget_Amount = ?, Status = ? WHERE Budget_ID = ?',
            [newTotal, newRemaining, 'Active', budgetId]
        );

        // 5. Log Budget Transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Description)
             VALUES (?, 'INCREASE', ?, ?, ?, ?)`,
            [budgetId, amount, prevRemaining, newRemaining, `Budget increased by ₹${amount}. New total: ₹${newTotal}`]
        );

        await connection.commit();

        syncProjectData(budget.User_ID).catch(e => console.error('Budget Sync:', e));

        res.json({ message: 'Budget increased successfully', newTotal, newRemaining });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 5: REALLOCATE
// ==========================================
router.post('/reallocate', async (req, res) => {
    const { budgetId, eventId, reallocateAmount } = req.body;

    if (!budgetId || !eventId || !reallocateAmount) {
        return res.status(400).json({ error: 'All fields required: eventId, reallocateAmount' });
    }

    const amount = parseFloat(reallocateAmount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Reallocation amount must be positive' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get & validate budget
        const [budgetRows] = await connection.execute(
            'SELECT * FROM BUDGET_V2 WHERE Budget_ID = ? FOR UPDATE', [budgetId]
        );
        if (budgetRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Budget not found' }); }
        const budget = budgetRows[0];

        const check = checkBudgetActive(budget);
        if (!check.ok) { await connection.rollback(); return res.status(400).json({ error: check.msg }); }

        // 2. Calculate unallocated
        const [allocSum] = await connection.execute(
            'SELECT COALESCE(SUM(Allocated_Amount), 0) AS total FROM BUDGET_EVENTS WHERE Budget_ID = ?', [budgetId]
        );
        const unallocated = parseFloat(budget.Total_Budget_Amount) - parseFloat(allocSum[0].total);

        if (amount > unallocated) {
            await connection.rollback();
            return res.status(400).json({ error: `Exceeds unallocated amount. Available: ₹${unallocated.toFixed(2)}` });
        }

        // 3. Get Event
        const [eventRows] = await connection.execute(
            'SELECT * FROM BUDGET_EVENTS WHERE Event_ID = ? AND Budget_ID = ? FOR UPDATE', [eventId, budgetId]
        );
        if (eventRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Event not found' }); }
        const event = eventRows[0];

        const prevEventBalance = parseFloat(event.Remaining_Event_Amount);
        const newAllocated = parseFloat(event.Allocated_Amount) + amount;
        const newEventRemaining = prevEventBalance + amount;

        // 4. Update Event
        await connection.execute(
            'UPDATE BUDGET_EVENTS SET Allocated_Amount = ?, Remaining_Event_Amount = ? WHERE Event_ID = ?',
            [newAllocated, newEventRemaining, eventId]
        );

        // 5. Log Budget Transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Event_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Previous_Event_Balance, New_Event_Balance, Description)
             VALUES (?, ?, 'REALLOCATE', ?, ?, ?, ?, ?, ?)`,
            [budgetId, eventId, amount, budget.Remaining_Budget_Amount, budget.Remaining_Budget_Amount, prevEventBalance, newEventRemaining, `Reallocated ₹${amount} to "${event.Event_Name}"`]
        );

        await connection.commit();

        syncProjectData(budget.User_ID).catch(e => console.error('Budget Sync:', e));

        res.json({ message: 'Reallocation successful', newAllocated, newEventRemaining });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 5.1: RETURN FUNDS (EVENT TO UNALLOCATED)
// ==========================================
router.post('/return-funds', async (req, res) => {
    const { budgetId, eventId, returnAmount } = req.body;

    if (!budgetId || !eventId || !returnAmount) {
        return res.status(400).json({ error: 'All fields required: eventId, returnAmount' });
    }

    const amount = parseFloat(returnAmount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Return amount must be positive' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get & validate budget
        const [budgetRows] = await connection.execute(
            'SELECT * FROM BUDGET_V2 WHERE Budget_ID = ? FOR UPDATE', [budgetId]
        );
        if (budgetRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Budget not found' }); }
        const budget = budgetRows[0];

        // 2. Get & validate event
        const [eventRows] = await connection.execute(
            'SELECT * FROM BUDGET_EVENTS WHERE Event_ID = ? AND Budget_ID = ? FOR UPDATE', [eventId, budgetId]
        );
        if (eventRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Event not found' }); }
        const event = eventRows[0];

        const eventRemaining = parseFloat(event.Remaining_Event_Amount);
        if (amount > eventRemaining) {
            await connection.rollback();
            return res.status(400).json({ error: `Not enough unused funds in category. Available: ₹${eventRemaining.toLocaleString()}` });
        }

        const newAllocated = parseFloat(event.Allocated_Amount) - amount;
        const newEventRemaining = eventRemaining - amount;

        // 3. Update Event (Decreasing allocation → Increases unallocated calculation)
        await connection.execute(
            'UPDATE BUDGET_EVENTS SET Allocated_Amount = ?, Remaining_Event_Amount = ? WHERE Event_ID = ?',
            [newAllocated, newEventRemaining, eventId]
        );

        // 4. Log Budget Transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Event_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Previous_Event_Balance, New_Event_Balance, Description)
             VALUES (?, ?, 'REALLOCATE', ?, ?, ?, ?, ?, ?)`,
            [budgetId, eventId, amount, budget.Remaining_Budget_Amount, budget.Remaining_Budget_Amount, eventRemaining, newEventRemaining, `Returned ₹${amount} from "${event.Event_Name}" to General Fund`]
        );

        await connection.commit();

        syncProjectData(budget.User_ID).catch(e => console.error('Budget Sync:', e));

        res.json({ message: 'Funds returned to general fund successfully', newAllocated, newEventRemaining });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 6: DELETE BUDGET (WITH REFUND)
// ==========================================
router.post('/delete', async (req, res) => {
    const { budgetId } = req.body;

    if (!budgetId) return res.status(400).json({ error: 'Budget ID is required' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get & validate budget
        const [budgetRows] = await connection.execute(
            'SELECT * FROM BUDGET_V2 WHERE Budget_ID = ? FOR UPDATE', [budgetId]
        );
        if (budgetRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Budget not found' }); }
        const budget = budgetRows[0];

        if (budget.Status === 'Deleted') {
            await connection.rollback();
            return res.status(400).json({ error: 'This budget has already been deleted.' });
        }

        const remainingAmount = parseFloat(budget.Remaining_Budget_Amount);
        const totalSpent = parseFloat(budget.Total_Budget_Amount) - remainingAmount;

        // 2. Refund remaining amount back to source account (if any)
        if (remainingAmount > 0) {
            // Insert Income transaction → trigger auto-credits account
            await connection.execute(
                `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                 VALUES (?, ?, ?, 'Income', 'Transfer', ?, NOW())`,
                [budget.User_ID, budget.Source_Account_ID, remainingAmount,
                `Budget Deleted (Refund): ${budget.Budget_Name} — ₹${remainingAmount} returned`]
            );
        }

        // 3. Mark budget as Deleted (soft delete — history preserved)
        await connection.execute(
            'UPDATE BUDGET_V2 SET Status = ?, Remaining_Budget_Amount = 0 WHERE Budget_ID = ?',
            ['Deleted', budgetId]
        );

        // 4. Log DELETE_REFUND transaction
        await connection.execute(
            `INSERT INTO BUDGET_TRANSACTION (Budget_ID, Transaction_Type, Amount, Previous_Budget_Balance, New_Budget_Balance, Description)
             VALUES (?, 'DELETE_REFUND', ?, ?, 0, ?)`,
            [budgetId, remainingAmount, remainingAmount,
                `Budget "${budget.Budget_Name}" deleted. ₹${remainingAmount.toFixed(2)} refunded. ₹${totalSpent.toFixed(2)} was spent.`]
        );

        await connection.commit();

        syncProjectData(budget.User_ID).catch(e => console.error('Budget Sync:', e));

        res.json({
            message: 'Budget deleted and remaining funds refunded',
            refundedAmount: remainingAmount,
            totalSpent: totalSpent
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error deleting budget:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
//   STEP 7 & 8: TRANSACTION HISTORY
// ==========================================
router.get('/history/:budgetId', async (req, res) => {
    const { budgetId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT bt.*, be.Event_Name
             FROM BUDGET_TRANSACTION bt
             LEFT JOIN BUDGET_EVENTS be ON bt.Event_ID = be.Event_ID
             WHERE bt.Budget_ID = ?
             ORDER BY bt.Created_At DESC`,
            [budgetId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
