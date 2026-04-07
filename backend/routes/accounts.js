const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all accounts for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [accounts] = await db.query(
            'SELECT * FROM ACCOUNT WHERE User_ID = ? ORDER BY Created_At DESC',
            [userId]
        );
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new account
router.post('/', async (req, res) => {
    const { user_id, account_name, account_type, balance } = req.body;

    if (!user_id || !account_name || !account_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)',
            [user_id, account_name, account_type, balance || 0]
        );
        res.json({
            message: 'Account created successfully',
            account_id: result.insertId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update account
router.put('/:accountId', async (req, res) => {
    const { accountId } = req.params;
    const { account_name, account_type } = req.body;

    try {
        await db.execute(
            'UPDATE ACCOUNT SET Account_Name = ?, Account_Type = ? WHERE Account_ID = ?',
            [account_name, account_type, accountId]
        );
        res.json({ message: 'Account updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete account
router.delete('/:accountId', async (req, res) => {
    const { accountId } = req.params;

    try {
        await db.execute('DELETE FROM ACCOUNT WHERE Account_ID = ?', [accountId]);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Transfer between accounts (Atomic Transaction)
router.post('/transfer', async (req, res) => {
    const { user_id, from_account_id, to_account_id, amount } = req.body;

    if (!user_id || !from_account_id || !to_account_id || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid transfer request' });
    }

    if (from_account_id === to_account_id) {
        return res.status(400).json({ error: 'Cannot transfer to same account' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check Balance
        const [rows] = await connection.execute('SELECT Balance FROM ACCOUNT WHERE Account_ID = ? FOR UPDATE', [from_account_id]);
        const account = rows[0];

        if (!account || account.Balance < amount) {
            await connection.rollback();
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Create Transfer Record
        await connection.execute(
            `INSERT INTO TRANSFER (User_ID, From_Account_ID, To_Account_ID, Amount) VALUES (?, ?, ?, ?)`,
            [user_id, from_account_id, to_account_id, amount]
        );

        // Deduct from Source
        await connection.execute('UPDATE ACCOUNT SET Balance = Balance - ? WHERE Account_ID = ?', [amount, from_account_id]);

        // Add to Destination
        await connection.execute('UPDATE ACCOUNT SET Balance = Balance + ? WHERE Account_ID = ?', [amount, to_account_id]);

        await connection.commit();
        res.json({ message: 'Transfer completed successfully' });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
