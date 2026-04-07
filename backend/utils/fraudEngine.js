/**
 * Rule-Based Fraud Engine (Phase 3)
 * Runs inside Node.js – no external service needed.
 * Returns { fraud_status, risk_score, reasons[] }
 */
const db = require('../db');

/**
 * Evaluate a transaction against fraud rules.
 * @param {object} tx  - { user_id, account_id, amount, transaction_type, transaction_datetime }
 * @returns {Promise<{fraud_status: string, risk_score: number, reasons: string[]}>}
 */
async function evaluateFraud(tx) {
    const { user_id, amount, transaction_datetime } = tx;
    const amt = parseFloat(amount);
    const reasons = [];
    let score = 0;

    // ── Rule 1: Large amount ─────────────────────────────────
    if (amt > 50000) {
        score += 40;
        reasons.push(`Large transaction: ₹${amt.toLocaleString()} exceeds ₹50,000 threshold`);
    } else if (amt > 20000) {
        score += 15;
        reasons.push(`Moderately large transaction: ₹${amt.toLocaleString()}`);
    }

    // ── Rule 2: High frequency (5+ transactions in 1 minute) ─
    try {
        const [freqRows] = await db.query(
            `SELECT COUNT(*) as cnt FROM \`TRANSACTION\`
             WHERE User_ID = ? AND Transaction_DateTime >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [user_id]
        );
        const recentCount = parseInt(freqRows[0]?.cnt || 0);
        if (recentCount >= 5) {
            score += 50;
            reasons.push(`High frequency: ${recentCount} transactions in the last minute`);
        } else if (recentCount >= 3) {
            score += 20;
            reasons.push(`Elevated frequency: ${recentCount} transactions in the last minute`);
        }
    } catch (_) { /* non-blocking */ }

    // ── Rule 3: Unusual time (midnight 00:00–05:00) ──────────
    const txDate = transaction_datetime ? new Date(transaction_datetime) : new Date();
    const hour = txDate.getHours();
    if (hour >= 0 && hour < 5) {
        score += 25;
        reasons.push(`Unusual transaction time: ${txDate.toLocaleTimeString()} (midnight hours)`);
    }

    // ── Rule 4: Round large amounts (potential structuring) ──
    if (amt >= 10000 && amt % 10000 === 0) {
        score += 10;
        reasons.push(`Suspiciously round amount: ₹${amt.toLocaleString()}`);
    }

    // ── Determine status ─────────────────────────────────────
    let fraud_status = 'SAFE';
    if (score >= 60) fraud_status = 'FRAUD';
    else if (score >= 25) fraud_status = 'SUSPICIOUS';

    return { fraud_status, risk_score: Math.min(score, 100), reasons };
}

module.exports = { evaluateFraud };
