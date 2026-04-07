const db = require('../db');

/**
 * Check and auto-process Savings Goal EMI deductions for a user.
 * Called at dashboard load (same pattern as emiHelper.js).
 */
const checkAndProcessSavingsEMIs = async (userId) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const todayStr = today.toISOString().split('T')[0];

    try {
        // Get all active savings goals with EMI enabled for this user
        const [goals] = await db.query(
            `SELECT s.*, a.Balance as Account_Balance
             FROM SAVINGS s
             LEFT JOIN ACCOUNT a ON s.Account_ID = a.Account_ID
             WHERE s.User_ID = ? AND s.Status = 'Active' AND s.EMI_Enabled = TRUE`,
            [userId]
        );

        if (!goals || goals.length === 0) return;

        for (const goal of goals) {
            // Check if EMI is due (day has passed or is today)
            if (goal.EMI_Date <= currentDay) {
                // Check if already deducted this month
                const lastDeductedMonth = goal.Last_EMI_Deducted
                    ? new Date(goal.Last_EMI_Deducted).toISOString().slice(0, 7)
                    : null;

                if (lastDeductedMonth === currentMonthStr) {
                    continue; // Already processed this month
                }

                // Calculate how much to deduct (min of EMI amount and remaining)
                const remaining = parseFloat(goal.Target_Amount) - parseFloat(goal.Current_Amount);
                if (remaining <= 0) {
                    // Goal already achieved, mark it
                    await db.execute(
                        'UPDATE SAVINGS SET Status = ?, EMI_Enabled = FALSE WHERE Goal_ID = ?',
                        ['Achieved', goal.Goal_ID]
                    );
                    continue;
                }

                const deductAmount = Math.min(parseFloat(goal.EMI_Amount), remaining);

                // Check account balance
                if (!goal.Account_ID || goal.Account_Balance === null || goal.Account_Balance === undefined) {
                    // No account linked — log failure
                    await logEMIHistory(goal.Goal_ID, deductAmount, todayStr, 'Failed', 'No account linked');
                    console.log(`❌ Savings EMI failed for "${goal.Goal_Title}": No account linked`);
                    continue;
                }

                if (parseFloat(goal.Account_Balance) < deductAmount) {
                    // Insufficient funds — log failure
                    await logEMIHistory(goal.Goal_ID, deductAmount, todayStr, 'Failed', 'Insufficient balance');
                    console.log(`❌ Savings EMI failed for "${goal.Goal_Title}": Insufficient balance`);
                    continue;
                }

                // PROCESS THE DEDUCTION
                let connection;
                try {
                    connection = await db.getConnection();
                    await connection.beginTransaction();

                    // 1. Log Transaction (trigger handles balance deduction from account)
                    await connection.execute(
                        `INSERT INTO \`TRANSACTION\` 
                        (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                        VALUES (?, ?, NULL, ?, 'Expense', 'EMI', ?, ?)`,
                        [goal.User_ID, goal.Account_ID, deductAmount, `Savings EMI: ${goal.Goal_Title}`, todayStr]
                    );

                    // 2. Update Savings Goal progress
                    const newAmount = parseFloat(goal.Current_Amount) + deductAmount;
                    const newStatus = newAmount >= parseFloat(goal.Target_Amount) ? 'Achieved' : 'Active';
                    const newEmiEnabled = newStatus === 'Achieved' ? false : goal.EMI_Enabled;

                    await connection.execute(
                        'UPDATE SAVINGS SET Current_Amount = ?, Status = ?, EMI_Enabled = ?, Last_EMI_Deducted = ? WHERE Goal_ID = ?',
                        [newAmount, newStatus, newEmiEnabled, todayStr, goal.Goal_ID]
                    );

                    // 3. Log EMI History
                    await connection.execute(
                        `INSERT INTO SAVINGS_EMI_HISTORY (Goal_ID, EMI_Amount, Deduction_Date, Status)
                         VALUES (?, ?, ?, 'Success')`,
                        [goal.Goal_ID, deductAmount, todayStr]
                    );

                    await connection.commit();
                    console.log(`✅ Savings EMI processed: "${goal.Goal_Title}" — ₹${deductAmount}`);

                } catch (err) {
                    if (connection) await connection.rollback();
                    // Log failure
                    await logEMIHistory(goal.Goal_ID, deductAmount, todayStr, 'Failed', err.message);
                    console.error(`❌ Error processing Savings EMI "${goal.Goal_Title}":`, err.message);
                } finally {
                    if (connection) connection.release();
                }
            }
        }
    } catch (err) {
        console.error('Error in checkAndProcessSavingsEMIs:', err);
        throw err;
    }
};

// Helper to log EMI history (outside transaction — for failures)
async function logEMIHistory(goalId, amount, date, status, reason) {
    try {
        await db.execute(
            `INSERT INTO SAVINGS_EMI_HISTORY (Goal_ID, EMI_Amount, Deduction_Date, Status, Failure_Reason)
             VALUES (?, ?, ?, ?, ?)`,
            [goalId, amount, date, status, reason || null]
        );
    } catch (err) {
        console.error('Failed to log EMI history:', err.message);
    }
}

module.exports = { checkAndProcessSavingsEMIs };
