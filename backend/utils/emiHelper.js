const db = require('../db');

const checkAndProcessEMIs = async (userId) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const todayStr = today.toISOString().split('T')[0];

    try {
        const [emis] = await db.query('SELECT * FROM EMI WHERE User_ID = ? AND Status = "Active"', [userId]);

        if (!emis || emis.length === 0) return;

        for (const emi of emis) {
            // Check if EMI is due (Day passed or is today)
            if (emi.EMI_Day <= currentDay) {
                // Check if already paid this month
                const lastDeductedMonth = emi.Last_Deducted ? new Date(emi.Last_Deducted).toISOString().slice(0, 7) : null;

                if (lastDeductedMonth !== currentMonthStr) {
                    // PROCESS PAYMENT
                    console.log(`Auto-processing EMI via PL/SQL: ${emi.EMI_Title} for User ${userId}`);

                    try {
                        await db.query('CALL sp_process_emi_payment(?, ?)', [
                            emi.EMI_ID, 
                            `Auto-EMI: ${emi.EMI_Title}`
                        ]);
                        console.log(`Successfully processed EMI: ${emi.EMI_Title}`);
                    } catch (err) {
                        console.error(`Error processing EMI ${emi.EMI_Title}:`, err.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error in checkAndProcessEMIs:", err);
        throw err;
    }
};

module.exports = { checkAndProcessEMIs };
