/**
 * Fraud Detection Route (Phase 2 + 3)
 * POST /api/fraud/predict  – evaluate a transaction for fraud
 * GET  /api/fraud/:userId  – get fraud history for a user
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { evaluateFraud } = require('../utils/fraudEngine');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * Try to call the Python ML API; fall back gracefully if unavailable.
 */
async function callMLApi(payload) {
    try {
        // Dynamic import of node-fetch or use built-in fetch (Node 18+)
        const fetchFn = globalThis.fetch || (await import('node-fetch').then(m => m.default).catch(() => null));
        if (!fetchFn) return null;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
        const resp = await fetchFn(`${ML_API_URL}/predict-fraud`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (_) {
        return null; // ML API offline – use rules only
    }
}

// POST /api/fraud/predict
router.post('/predict', async (req, res) => {
    const { user_id, account_id, amount, transaction_type, transaction_datetime, transaction_id } = req.body;

    if (!user_id || !amount) {
        return res.status(400).json({ error: 'user_id and amount are required' });
    }

    try {
        // 1. Rule-based evaluation
        const ruleResult = await evaluateFraud({ user_id, account_id, amount, transaction_type, transaction_datetime });

        // 2. ML API evaluation (optional, non-blocking)
        const mlResult = await callMLApi({ amount: parseFloat(amount), user_id, transaction_datetime });

        // 3. Combine: take the more severe verdict
        let final_status = ruleResult.fraud_status;
        let final_score = ruleResult.risk_score;
        const ml_prediction = mlResult?.prediction || null;

        if (mlResult) {
            // ML returns { prediction: 'Safe'|'Suspicious'|'Fraud', score: 0-100 }
            const severity = { Safe: 0, Suspicious: 1, Fraud: 2 };
            if ((severity[mlResult.prediction] || 0) > (severity[final_status] || 0)) {
                final_status = mlResult.prediction;
                final_score = Math.max(final_score, mlResult.score || 0);
            }
        }

        // 4. Persist result if transaction_id provided
        if (transaction_id) {
            await db.query(
                'UPDATE `TRANSACTION` SET fraud_status = ?, risk_score = ? WHERE Transaction_ID = ?',
                [final_status, final_score, transaction_id]
            ).catch(() => {});
        }

        res.json({
            fraud_status: final_status,
            risk_score: final_score,
            reasons: ruleResult.reasons,
            ml_prediction,
            ml_available: !!mlResult
        });
    } catch (err) {
        console.error('[Fraud Route]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fraud/:userId – fraud history
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT t.Transaction_ID, t.Amount, t.Transaction_Type, t.Description,
                    t.fraud_status, t.risk_score, t.Transaction_DateTime,
                    a.Account_Name, c.Category_Name
             FROM \`TRANSACTION\` t
             LEFT JOIN ACCOUNT a ON t.Account_ID = a.Account_ID
             LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
             WHERE t.User_ID = ? AND t.fraud_status != 'Safe'
             ORDER BY t.Transaction_DateTime DESC
             LIMIT 100`,
            [userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fraud/stats/:userId – summary counts
router.get('/stats/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT fraud_status, COUNT(*) as count
             FROM \`TRANSACTION\`
             WHERE User_ID = ?
             GROUP BY fraud_status`,
            [userId]
        );
        const stats = { Safe: 0, Suspicious: 0, Fraud: 0 };
        rows.forEach(r => { stats[r.fraud_status] = r.count; });
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
