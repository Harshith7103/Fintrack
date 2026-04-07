const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncProjectData } = require('../utils/syncHelper');

// Get all active events for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [events] = await db.query(
            `SELECT * FROM EVENTS WHERE User_ID = ? ORDER BY Created_At DESC`,
            [userId]
        );

        const promises = events.map(async (event) => {
            const [cats] = await db.query('SELECT * FROM EVENT_CATEGORIES WHERE Event_ID = ?', [event.Event_ID]);
            return { ...event, categories: cats };
        });

        const fullEvents = await Promise.all(promises);

        // --- UNIVERSAL SYNC ---
        syncProjectData(userId).catch(e => console.error('Event Sync Error:', e.message));

        res.json(fullEvents);
    } catch (err) {
        console.error("Event fetch failed:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Create new event budget
router.post('/create', async (req, res) => {
    const { user_id, title, description, total_budget, account_id, categories } = req.body;

    if (!user_id || !title || !total_budget || !account_id || !categories || categories.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate category sum matches total budget
    const categorySum = categories.reduce((sum, cat) => sum + parseFloat(cat.amount), 0);
    if (Math.abs(categorySum - parseFloat(total_budget)) > 1) {
        return res.status(400).json({ error: `Category sum (${categorySum}) does not match Total Budget (${total_budget})` });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Check Account Balance
        const [[account]] = await connection.query('SELECT Balance FROM ACCOUNT WHERE Account_ID = ?', [account_id]);
        if (!account) throw new Error('Account not found');
        if (parseFloat(account.Balance) < parseFloat(total_budget)) throw new Error('Insufficient funds');

        // 2. Deduct from Account
        await connection.query('UPDATE ACCOUNT SET Balance = Balance - ? WHERE Account_ID = ?', [total_budget, account_id]);

        // 3. Log Transfer Transaction
        const today = new Date().toISOString().split('T')[0];
        await connection.query(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime) 
             VALUES (?, ?, NULL, ?, 'Expense', 'Transfer', ?, ?)`,
            [user_id, account_id, total_budget, `Budget Alloc: ${title}`, today]
        );

        // 4. Create Event
        const [eventResult] = await connection.query(
            `INSERT INTO EVENTS (User_ID, Title, Description, Total_Budget, Remaining_Budget) VALUES (?, ?, ?, ?, ?)`,
            [user_id, title, description || '', total_budget, total_budget]
        );
        const eventId = eventResult.insertId;

        // 5. Create Categories
        for (const cat of categories) {
            await connection.query(
                'INSERT INTO EVENT_CATEGORIES (Event_ID, Category_Name, Allocated_Amount) VALUES (?, ?, ?)',
                [eventId, cat.name, cat.amount]
            );
        }

        await connection.commit();

        // SYNC
        syncProjectData(user_id).catch(e => console.error('Event Sync Error:', e.message));

        res.json({ message: 'Budget created successfully', event_id: eventId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Create event failed:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Record expense for an event
router.post('/:eventId/expense', async (req, res) => {
    const { eventId } = req.params;
    const { category_id, amount, description } = req.body;

    try {
        const [[event]] = await db.query('SELECT * FROM EVENTS WHERE Event_ID = ?', [eventId]);
        const [[cat]] = await db.query('SELECT * FROM EVENT_CATEGORIES WHERE Category_ID = ?', [category_id]);
        if (!event || !cat) return res.status(404).json({ error: 'Event or category not found' });

        const newCatSpent = parseFloat(cat.Spent_Amount) + parseFloat(amount);
        const newEventRem = parseFloat(event.Remaining_Budget) - parseFloat(amount);

        await db.query('UPDATE EVENT_CATEGORIES SET Spent_Amount = ? WHERE Category_ID = ?', [newCatSpent, category_id]);
        const status = newEventRem <= 0 ? 'Completed' : 'Active';
        await db.query('UPDATE EVENTS SET Remaining_Budget = ?, Status = ? WHERE Event_ID = ?', [newEventRem, status, eventId]);

        // SYNC
        syncProjectData(event.User_ID).catch(e => console.error('Event Sync Error:', e.message));

        res.json({ message: 'Expense recorded', remaining: newEventRem });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
