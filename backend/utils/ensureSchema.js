const db = require('../db');

/**
 * Ensures all required schema columns exist (idempotent – safe to run on every startup).
 */
async function ensureFraudColumns() {
    const alterations = [
        // Existing ones (kept for safety if previously used)
        `ALTER TABLE \`TRANSACTION\` ADD COLUMN fraud_status ENUM('Safe','Suspicious','Fraud') DEFAULT 'Safe'`,
        `ALTER TABLE \`TRANSACTION\` ADD COLUMN risk_score INT DEFAULT 0`,
        // Requested by user
        `ALTER TABLE \`TRANSACTION\` ADD COLUMN fraud_score FLOAT DEFAULT 0.0`,
        `ALTER TABLE \`TRANSACTION\` ADD COLUMN fraud_flag TEXT`,
        `ALTER TABLE \`TRANSACTION\` ADD COLUMN fraud_reason TEXT`,
        
        `ALTER TABLE AUDIT_LOG ADD COLUMN Description TEXT`,
        // Modify Action_Type to include LOGIN (safe if already correct)
        `ALTER TABLE AUDIT_LOG MODIFY COLUMN Action_Type ENUM('INSERT','UPDATE','DELETE','LOGIN') DEFAULT 'INSERT'`,
    ];
    for (const sql of alterations) {
        try {
            await db.query(sql);
        } catch (err) {
            const msg = String(err.message || '');
            if (!msg.includes('Duplicate column') && !msg.includes('already exists')) {
                console.warn('[schema] alter warning:', msg.substring(0, 80));
            }
        }
    }
}

/**
 * Adds USERS.Account_Status and role if missing.
 */
async function ensureUserAccountStatusColumn() {
    try {
        await db.query(`
            ALTER TABLE USERS
            ADD COLUMN Account_Status ENUM('active', 'blocked') NOT NULL DEFAULT 'active'
        `);
        console.log('[schema] Added column USERS.Account_Status');
    } catch (err) {
        const msg = String(err.message || '');
        if (!msg.includes('Duplicate column') && !msg.includes('already exists')) {
            console.warn('[schema] Could not add Account_Status:', msg);
        }
    }
    try {
        await db.query(`
            ALTER TABLE USERS
            ADD COLUMN role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER'
        `);
        console.log('[schema] Added column USERS.role');
    } catch (err) {
        const msg = String(err.message || '');
        if (!msg.includes('Duplicate column') && !msg.includes('already exists')) {
            console.warn('[schema] Could not add role:', msg);
        }
    }
}

module.exports = { ensureUserAccountStatusColumn, ensureFraudColumns };
