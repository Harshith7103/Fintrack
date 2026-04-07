const express = require('express');
const router = express.Router();
const db = require('../db');
const { Notification } = require('../mongodb');
const { evaluateFraud } = require('../utils/fraudEngine');

// Helper to find random user account ID to mock transaction structure
async function getAccountForUser(userId) {
    try {
        const [rows] = await db.query('SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? LIMIT 1', [userId]);
        return rows[0]?.Account_ID || null;
    } catch {
        return null;
    }
}

router.post('/', async (req, res) => {
    try {
        const { user_id, simulation_type, amount } = req.body;
        console.log(`[SIMULATION] Starting ${simulation_type} for User #${user_id} (${amount}₹)`);
        
        if (!user_id || !simulation_type || amount === undefined) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        // Fetch User Info
        const [userRows] = await db.query('SELECT Name, Email FROM USERS WHERE User_ID = ?', [user_id]);
        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        const user = userRows[0];
        const account_id = await getAccountForUser(user_id) || 1;

        const txObj = {
            user_id: parseInt(user_id, 10),
            account_id,
            amount: parseFloat(amount),
            transaction_datetime: new Date().toISOString(),
            transaction_type: 'Expense',
            description: `SIMULATED ${simulation_type} TRANSACTION`
        };

        let resultData = { fraud_status: 'SAFE', risk_score: 0, reasons: [] };

        if (simulation_type === 'NORMAL') {
            resultData = { fraud_status: 'SAFE', risk_score: 0, reasons: ["Passed normal simulation check. Amount within typical limits."] };
        } 
        else if (simulation_type === 'FRAUD') {
            resultData = await evaluateFraud({ ...txObj, amount: parseFloat(amount) > 50000 ? parseFloat(amount) : 51000 });
        }
        else if (simulation_type === 'HIGH_FREQUENCY') {
            resultData = {
                fraud_status: 'SUSPICIOUS',
                risk_score: 85,
                reasons: ['High frequency: simulated 15 transactions in the last minute']
            };
        }
        else if (simulation_type === 'ML_PREDICTION') {
            try {
                // Use native fetch (Node 18+) to call Python ML API
                const ML_URL = process.env.ML_API_URL || 'http://localhost:8000';
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4000);
                const resp = await fetch(`${ML_URL}/predict-fraud`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: parseFloat(amount), user_id: parseInt(user_id, 10), transaction_datetime: new Date().toISOString() }),
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const mlData = await resp.json();
                resultData = {
                    fraud_status: (mlData.prediction || 'SAFE').toUpperCase(),
                    risk_score: mlData.score || 0,
                    reasons: [`ML prediction: ${mlData.prediction} (confidence: ${mlData.confidence})`]
                };
            } catch (err) {
                console.error("[SIMULATION] ML Fail:", err.message);
                return res.status(502).json({ success: false, error: "ML Service unavailable. Start it with: uvicorn api:app --port 8000" });
            }
        } else {
            return res.status(400).json({ success: false, error: "Invalid simulation_type." });
        }

        // Create MongoDB alert if suspicious/fraud
        if (['FRAUD', 'SUSPICIOUS'].includes(resultData.fraud_status)) {
            try {
                const newNotification = new Notification({
                    user_id: txObj.user_id,
                    user_name: user?.Name || user?.Full_Name || 'Simulated User',
                    user_email: user?.Email || '',
                    type: 'AUTOMATED',
                    alert_type: 'FRAUD',
                    message: `🚨 SECURITY ALERT: ${resultData.fraud_status} movement detected! (${simulation_type})`,
                    timestamp: new Date(),
                    details: {
                        simulation_type,
                        amount: txObj.amount,
                        risk_score: resultData.risk_score,
                        reason: resultData.reasons?.join(', ') || 'AI Model Flag'
                    },
                    alert_status: 'ACTIVE'
                });
                const saved = await newNotification.save();
                console.log(`[SIMULATION] Alert PERSISTED: ${saved._id} for User #${user_id}`);
            } catch (err) { console.error("[SIMULATION] Persistence Error:", err.message); }
        }

        return res.json({
            success: true,
            message: `Simulation ${simulation_type} completed`,
            result: resultData
        });

    } catch (error) {
        console.error("Simulation Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
