const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all salary configurations for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [salaries] = await db.query(
            `SELECT s.*, a.Account_Name, c.Category_Name 
             FROM SALARY s
             JOIN ACCOUNT a ON s.Account_ID = a.Account_ID
             JOIN CATEGORY c ON s.Category_ID = c.Category_ID
             WHERE s.User_ID = ?
             ORDER BY s.Status DESC, s.Created_At DESC`,
            [userId]
        );
        res.json(salaries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create salary configuration (for auto-credit)
router.post('/configure', async (req, res) => {
    const { user_id, account_id, category_id, amount, salary_day } = req.body;

    if (!user_id || !account_id || !amount || !salary_day) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        let catId = category_id;

        // Get or create Salary category logic - simplified for MySQL
        // If category_id is provided, use it. If not, try to find 'Salary' category.
        if (!category_id) {
            const [catRows] = await db.query('SELECT Category_ID FROM CATEGORY WHERE User_ID = ? AND Category_Name = ?', [user_id, 'Salary']);
            if (catRows.length > 0) {
                catId = catRows[0].Category_ID;
            } else {
                // Create Salary category
                const [newCat] = await db.execute(
                    'INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)',
                    [user_id, 'Salary', 'Income']
                );
                catId = newCat.insertId;
            }
        }

        const [result] = await db.execute(
            `INSERT INTO SALARY (User_ID, Account_ID, Category_ID, Amount, Salary_Day, Status)
             VALUES (?, ?, ?, ?, ?, 'Active')`,
            [user_id, account_id, catId, amount, salary_day]
        );

        res.json({
            message: 'Salary configuration created successfully',
            salary_id: result.insertId
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual salary credit
router.post('/credit', async (req, res) => {
    const { user_id, account_id, amount, description } = req.body;

    if (!user_id || !account_id || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const creditDate = new Date().toISOString();
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        let catId;
        // Check for Salary Category
        const [catRows] = await connection.query('SELECT Category_ID FROM CATEGORY WHERE User_ID = ? AND Category_Name = ?', [user_id, 'Salary']);
        if (catRows.length > 0) {
            catId = catRows[0].Category_ID;
        } else {
            // Create Salary category
            const [newCat] = await connection.execute(
                'INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)',
                [user_id, 'Salary', 'Income']
            );
            catId = newCat.insertId;
        }

        // Insert transaction
        const [txnResult] = await connection.execute(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
             VALUES (?, ?, ?, ?, 'Income', 'Salary', ?, ?)`,
            [user_id, account_id, catId, amount, description || 'Manual Salary Credit', creditDate]
        );

        // Update account balance - REMOVED (Handled by Trigger)
        // await connection.execute(
        //    'UPDATE ACCOUNT SET Balance = Balance + ? WHERE Account_ID = ?',
        //    [amount, account_id]
        // );

        await connection.commit();

        res.json({
            message: 'Salary credited successfully',
            transaction_id: txnResult.insertId
        });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Update salary configuration
router.put('/:salaryId', async (req, res) => {
    const { salaryId } = req.params;
    const { amount, salary_day, status } = req.body;

    try {
        await db.execute(
            'UPDATE SALARY SET Amount = ?, Salary_Day = ?, Status = ? WHERE Salary_ID = ?',
            [amount, salary_day, status, salaryId]
        );
        res.json({ message: 'Salary configuration updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete salary configuration
router.delete('/:salaryId', async (req, res) => {
    const { salaryId } = req.params;

    try {
        await db.execute('DELETE FROM SALARY WHERE Salary_ID = ?', [salaryId]);
        res.json({ message: 'Salary configuration deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Process auto-credit (called by scheduler or manually)
router.post('/process/:salaryId', async (req, res) => {
    const { salaryId } = req.params;

    try {
        await db.query('CALL sp_process_salary_credit(?)', [salaryId]);
        res.json({ message: 'Salary processed successfully' });
    } catch (err) {
        if (err.message.includes('inactive')) {
            return res.status(404).json({ error: 'Salary configuration not found or inactive' });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
