const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { FinancialLog }            = require('../mongodb');
const { syncProjectData }         = require('../utils/syncHelper');
const { evaluateFraud }           = require('../utils/fraudEngine');

// ─────────────────────────────────────────────────────────────
//  EXCEPTION HANDLING HELPER
// ─────────────────────────────────────────────────────────────
function handleError(res, err, code = 500) {
    console.error('[Transactions Route Error]', err.message);
    res.status(code).json({ success: false, error: err.message });
}

// ─────────────────────────────────────────────────────────────
//  READ – Get transactions with multi-filter querying
// ─────────────────────────────────────────────────────────────
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    const {
        start_date, end_date, category_id,
        transaction_type, account_id,
        min_amount, max_amount,
        reference_type, search,
        limit = 500, offset = 0
    } = req.query;

    if (!userId || isNaN(parseInt(userId)))
        return handleError(res, new Error('Valid user_id is required'), 400);

    let query = `
        SELECT t.*, 
               a.Account_Name,
               COALESCE(c.Category_Name,
                 CASE 
                   WHEN t.Description LIKE 'Budget%'                           THEN 'Budget Management'
                   WHEN t.Description LIKE 'Savings%' OR t.Description LIKE 'Added to%' THEN 'Savings Goal'
                   ELSE 'System Transfer'
                 END
               ) AS Category_Name
        FROM \`TRANSACTION\` t
        LEFT JOIN ACCOUNT  a ON t.Account_ID  = a.Account_ID
        LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
        WHERE t.User_ID = ?`;

    const params = [userId];

    // ── dynamic filter chain ─────────────────────────────────
    if (start_date)        { query += ' AND DATE(t.Transaction_DateTime) >= ?'; params.push(start_date); }
    if (end_date)          { query += ' AND DATE(t.Transaction_DateTime) <= ?'; params.push(end_date); }
    if (category_id)       { query += ' AND t.Category_ID = ?';                params.push(category_id); }
    if (transaction_type)  { query += ' AND t.Transaction_Type = ?';           params.push(transaction_type); }
    if (account_id)        { query += ' AND t.Account_ID = ?';                 params.push(account_id); }
    if (min_amount)        { query += ' AND t.Amount >= ?';                    params.push(parseFloat(min_amount)); }
    if (max_amount)        { query += ' AND t.Amount <= ?';                    params.push(parseFloat(max_amount)); }
    if (reference_type)    { query += ' AND t.Reference_Type = ?';             params.push(reference_type); }
    if (search)            { query += ' AND t.Description LIKE ?';             params.push(`%${search}%`); }
    // ────────────────────────────────────────────────────────

    query += ` ORDER BY t.Transaction_DateTime DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    try {
        const [rows] = await db.query(query, params);

        // Non-blocking background sync
        syncProjectData(userId).catch(e => console.error('[Sync Error]', e.message));

        res.json(rows); // plain array – keeps frontend compatible
    } catch (err) { handleError(res, err); }
});

// ─────────────────────────────────────────────────────────────
//  READ SINGLE – individual transaction detail
// ─────────────────────────────────────────────────────────────
router.get('/detail/:transactionId', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, a.Account_Name, c.Category_Name
             FROM \`TRANSACTION\` t
             LEFT JOIN ACCOUNT  a ON t.Account_ID  = a.Account_ID
             LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
             WHERE t.Transaction_ID = ?`,
            [req.params.transactionId]
        );
        if (rows.length === 0)
            return handleError(res, new Error('Transaction not found'), 404);
        res.json({ success: true, data: rows[0] });
    } catch (err) { handleError(res, err); }
});

// ─────────────────────────────────────────────────────────────
//  CREATE – add a new transaction (with transaction + rollback)
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { user_id, account_id, category_id, amount, transaction_type, reference_type, description, transaction_datetime } = req.body;

    // ── Input validation (Exception Handling layer 1) ────────
    if (!user_id)          return handleError(res, new Error('user_id is required'), 400);
    if (!account_id)       return handleError(res, new Error('account_id is required'), 400);
    if (!amount || parseFloat(amount) <= 0)
                           return handleError(res, new Error('amount must be a positive number'), 400);
    if (!transaction_type) return handleError(res, new Error('transaction_type is required'), 400);
    if (!['Income', 'Expense'].includes(transaction_type))
                           return handleError(res, new Error("transaction_type must be 'Income' or 'Expense'"), 400);
    // ────────────────────────────────────────────────────────

    const formattedDate = new Date(transaction_datetime || new Date())
        .toISOString().slice(0, 19).replace('T', ' ');

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Account ownership validation (Exception Handling layer 2)
        const [accRows] = await connection.execute(
            'SELECT Balance FROM ACCOUNT WHERE Account_ID = ? AND User_ID = ? FOR UPDATE',
            [account_id, user_id]
        );
        if (accRows.length === 0)
            throw new Error('Account not found or does not belong to this user');

        // Overdraft protection for expenses (Exception Handling layer 3)
        if (transaction_type === 'Expense' && parseFloat(accRows[0].Balance) < parseFloat(amount))
            throw new Error(`Insufficient account balance. Available: ₹${parseFloat(accRows[0].Balance).toLocaleString()}`);

        // ── Connect to ML Micro-service (Fallback to SAFE) ──
        let fraud_score = 0.0;
        let fraud_flag = 'SAFE';
        let fraud_reason = 'Normal transaction behavior';

        try {
            const fetch = (await import('node-fetch')).default;
            const mlResponse = await fetch(process.env.ML_API_URL + '/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    timestamp: formattedDate,
                    user_id: user_id,
                    device_id: req.headers['user-agent'] || 'unknown',
                    location: req.headers['x-forwarded-for'] || 'unknown'
                }),
                timeout: 3000 // 3 seconds timeout
            });
            
            if (mlResponse.ok) {
                const mlData = await mlResponse.json();
                fraud_score = mlData.fraud_score;
                fraud_flag = mlData.fraud_label;
                fraud_reason = mlData.reason;
            }
        } catch (mlErr) {
            console.warn('[ML Service Unavailable] Fallback to SAFE', mlErr.message);
        }

        const [result] = await connection.execute(
            `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime, fraud_score, fraud_flag, fraud_reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, account_id, category_id || null, parseFloat(amount),
             transaction_type, reference_type || 'Manual', description || '', formattedDate, 
             fraud_score, fraud_flag, fraud_reason]
        );

        await connection.commit();

        // ── Emit Event ──
        const fraudEvents = require('../events/fraudEvents');
        fraudEvents.emit('transaction_created', {
            transaction_id: result.insertId,
            user_id, amount, fraud_flag, fraud_score, fraud_reason
        });

        // ── Post-commit side effects (non-blocking, won't fail the response) ──

        syncProjectData(user_id)
            .catch(e => console.error('[MongoDB Sync]', e.message));

        FinancialLog.create({
            user_id,
            event_type: 'TRANSACTION',
            details: { amount: parseFloat(amount), type: transaction_type, description, account_id },
            timestamp: new Date()
        }).catch(e => console.error('[FinancialLog]', e.message));

        res.status(201).json({
            success: true,
            message: fraud_flag === 'FRAUD' ? 'Warning: Suspicious transaction detected' : 'Transaction created successfully',
            transaction_id: result.insertId,
            fraud_status: fraud_flag
        });

    } catch (err) {
        if (connection) await connection.rollback();
        // HTTP 400 for business-rule failures, 500 for server errors
        const code = err.message.includes('Insufficient') || err.message.includes('does not belong') ? 400 : 500;
        handleError(res, err, code);
    } finally {
        if (connection) connection.release();
    }
});

// ─────────────────────────────────────────────────────────────
//  UPDATE – modify amount or category of an existing transaction
// ─────────────────────────────────────────────────────────────
router.put('/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { user_id, amount, category_id, description } = req.body;

    if (!user_id) return handleError(res, new Error('user_id is required'), 400);
    if (amount !== undefined && parseFloat(amount) <= 0)
        return handleError(res, new Error('amount must be positive'), 400);

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT * FROM `TRANSACTION` WHERE Transaction_ID = ? AND User_ID = ? FOR UPDATE',
            [transactionId, user_id]
        );
        if (rows.length === 0)
            throw Object.assign(new Error('Transaction not found or unauthorised'), { code: 404 });

        const txn      = rows[0];
        const newAmt   = amount     !== undefined ? parseFloat(amount)   : parseFloat(txn.Amount);
        const newCat   = category_id !== undefined ? category_id         : txn.Category_ID;
        const newDesc  = description !== undefined ? description          : txn.Description;

        await connection.execute(
            'UPDATE `TRANSACTION` SET Amount = ?, Category_ID = ?, Description = ? WHERE Transaction_ID = ?',
            [newAmt, newCat, newDesc, transactionId]
        );

        await connection.commit();

        // Sync after update
        syncProjectData(user_id).catch(e => console.error('[MongoDB Sync]', e.message));

        res.json({ success: true, message: 'Transaction updated successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        handleError(res, err, err.code === 404 ? 404 : 500);
    } finally {
        if (connection) connection.release();
    }
});

// ─────────────────────────────────────────────────────────────
//  DELETE – remove a transaction (soft safety check + rollback)
// ─────────────────────────────────────────────────────────────
router.delete('/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { user_id } = req.query;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT * FROM `TRANSACTION` WHERE Transaction_ID = ? FOR UPDATE',
            [transactionId]
        );
        if (rows.length === 0)
            throw Object.assign(new Error('Transaction not found'), { code: 404 });

        const txn = rows[0];
        if (user_id && String(txn.User_ID) !== String(user_id))
            throw Object.assign(new Error('Unauthorised – transaction belongs to another user'), { code: 403 });

        await connection.execute(
            'DELETE FROM `TRANSACTION` WHERE Transaction_ID = ?', [transactionId]
        );
        await connection.commit();

        syncProjectData(txn.User_ID).catch(e => console.error('[MongoDB Sync]', e.message));

        res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        const code = err.code === 404 ? 404 : err.code === 403 ? 403 : 500;
        handleError(res, err, code);
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
