const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all EMIs for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [emis] = await db.query(
            `SELECT e.*, a.Account_Name, c.Category_Name, a.Balance as Linked_Account_Balance
             FROM EMI e
             JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
             JOIN CATEGORY c ON e.Category_ID = c.Category_ID
             WHERE e.User_ID = ?
             ORDER BY e.Status, e.EMI_Day`,
            [userId]
        );

        // Calculate derived fields
        const enrichedEmis = emis.map(emi => {
            const totalPayable = emi.EMI_Amount * emi.Tenure_Months;

            // Estimate paid amount
            const startDate = new Date(emi.Start_Date);
            const today = new Date();
            let monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
            if (today.getDate() < startDate.getDate()) monthsPassed--;
            if (monthsPassed < 0) monthsPassed = 0;
            if (monthsPassed > emi.Tenure_Months) monthsPassed = emi.Tenure_Months;

            const amountPaid = emi.EMI_Amount * monthsPassed;
            const remainingBalance = totalPayable - amountPaid;

            return {
                ...emi,
                Total_Payable: parseFloat(totalPayable.toFixed(2)),
                Amount_Paid: parseFloat(amountPaid.toFixed(2)),
                Remaining_Balance: parseFloat(remainingBalance.toFixed(2)),
                Months_Paid: monthsPassed
            };
        });

        res.json(enrichedEmis);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new EMI
router.post('/', async (req, res) => {
    const { user_id, account_id, category_id, emi_title, lender_name, total_loan_amount, interest_rate, tenure_months, start_date, emi_day } = req.body;

    if (!user_id || !account_id || !category_id || !emi_title || !total_loan_amount || !interest_rate || !tenure_months || !start_date || !emi_day) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (parseFloat(total_loan_amount) <= 0 || parseFloat(interest_rate) < 0 || parseInt(tenure_months) <= 0) {
        return res.status(400).json({ error: 'Invalid input values. Amount and tenure must be positive.' });
    }


    const P = parseFloat(total_loan_amount);
    const r = parseFloat(interest_rate) / 12 / 100;
    const n = parseInt(tenure_months);

    let emi_amount;
    if (r === 0) {
        emi_amount = P / n;
    } else {
        emi_amount = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    emi_amount = parseFloat(emi_amount.toFixed(2));

    const start = new Date(start_date);
    const end = new Date(start);
    end.setMonth(end.getMonth() + n);
    const end_date = end.toISOString().split('T')[0];

    try {
        const [result] = await db.execute(
            `INSERT INTO EMI (User_ID, Account_ID, Category_ID, EMI_Title, Lender_Name, Total_Loan_Amount, Interest_Rate, Tenure_Months, EMI_Amount, EMI_Day, Start_Date, End_Date, Status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
            [user_id, account_id, category_id, emi_title, lender_name, P, parseFloat(interest_rate), n, emi_amount, emi_day, start_date, end_date]
        );

        res.json({
            message: 'EMI created successfully',
            emi_id: result.insertId,
            calculated_emi: emi_amount,
            end_date: end_date
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update EMI
router.put('/:emiId', async (req, res) => {
    const { emiId } = req.params;
    const { emi_title, emi_amount, emi_day, end_date, status } = req.body;

    try {
        await db.execute(
            `UPDATE EMI 
             SET EMI_Title = ?, EMI_Amount = ?, EMI_Day = ?, End_Date = ?, Status = ?
             WHERE EMI_ID = ?`,
            [emi_title, emi_amount, emi_day, end_date, status, emiId]
        );
        res.json({ message: 'EMI updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete EMI
router.delete('/:emiId', async (req, res) => {
    const { emiId } = req.params;

    try {
        await db.execute('DELETE FROM EMI WHERE EMI_ID = ?', [emiId]);
        res.json({ message: 'EMI deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Process EMI deduction
router.post('/process/:emiId', async (req, res) => {
    const { emiId } = req.params;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute('SELECT * FROM EMI WHERE EMI_ID = ? AND Status = "Active" FOR UPDATE', [emiId]);
        const emi = rows[0];

        if (!emi) {
            await connection.rollback();
            return res.status(404).json({ error: 'EMI not found or inactive' });
        }

        const today = new Date().toISOString().split('T')[0];

        // Check Account Balance
        const [accRows] = await connection.execute('SELECT Balance FROM ACCOUNT WHERE Account_ID = ? FOR UPDATE', [emi.Account_ID]);
        if (accRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Linked account not found' });
        }

        if (parseFloat(accRows[0].Balance) < parseFloat(emi.EMI_Amount)) {
            await connection.rollback();
            return res.status(400).json({ error: 'Insufficient funds in linked account for EMI deduction' });
        }


        // Create transaction
        await connection.execute(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
             VALUES (?, ?, ?, ?, 'Expense', 'EMI', ?, ?)`,
            [emi.User_ID, emi.Account_ID, emi.Category_ID, emi.EMI_Amount, `EMI: ${emi.EMI_Title}`, today]
        );

        // Update account balance - REMOVED (Handled by Trigger)
        // await connection.execute(
        //    'UPDATE ACCOUNT SET Balance = Balance - ? WHERE Account_ID = ?',
        //    [emi.EMI_Amount, emi.Account_ID]
        // );

        // Update last deducted date
        await connection.execute(
            'UPDATE EMI SET Last_Deducted = ? WHERE EMI_ID = ?',
            [today, emiId]
        );

        await connection.commit();
        res.json({ message: 'EMI processed successfully' });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
