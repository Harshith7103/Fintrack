const EventEmitter = require('events');
const db = require('../db');

class FraudEmitter extends EventEmitter {}

const fraudEvents = new FraudEmitter();

fraudEvents.on('transaction_created', async (transactionData) => {
    // transactionData: { transaction_id, user_id, amount, fraud_flag, fraud_score, fraud_reason }
    
    if (transactionData.fraud_flag === 'FRAUD') {
        console.warn(`[ALERT] FRAUD DETECTED for User ${transactionData.user_id}: ${transactionData.fraud_reason}`);
        
        // Log alert in DB if you have an alerts table, or audit log
        try {
            await db.query(`
                INSERT INTO AUDIT_LOG (User_ID, Action_Type, Action_Details, Description) 
                VALUES (?, 'INSERT', ?, ?)
            `, [
                transactionData.user_id, 
                `FRAUD ALERT: Txn ${transactionData.transaction_id}`, 
                transactionData.fraud_reason
            ]);
        } catch (e) {
            console.error('[Fraud Events DB Error]', e.message);
        }
        
        // Emitting 'alert' so socket/frontend stream could catch it
        fraudEvents.emit('alert_generated', transactionData);
    }
});

module.exports = fraudEvents;
