const db = require('./backend/db');
(async () => {
    try {
        await db.query('DROP PROCEDURE IF EXISTS sp_get_user_financial_summary');
        await db.query(`
            CREATE PROCEDURE sp_get_user_financial_summary(
                IN p_User_ID INT,
                IN p_Month_Year VARCHAR(7)
            )
            BEGIN
                DECLARE v_Total_Balance DECIMAL(15, 2);
                DECLARE v_Monthly_Income DECIMAL(15, 2);
                DECLARE v_Monthly_Expense DECIMAL(15, 2);

                SELECT COALESCE(SUM(Balance), 0) INTO v_Total_Balance FROM ACCOUNT WHERE User_ID = p_User_ID;

                SELECT COALESCE(SUM(Amount), 0) INTO v_Monthly_Income
                FROM \`TRANSACTION\`
                WHERE User_ID = p_User_ID 
                  AND Transaction_Type = 'Income'
                  AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

                SELECT COALESCE(SUM(Amount), 0) INTO v_Monthly_Expense
                FROM \`TRANSACTION\`
                WHERE User_ID = p_User_ID 
                  AND Transaction_Type = 'Expense'
                  AND (Reference_Type IS NULL OR Reference_Type != 'Transfer')
                  AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

                SELECT 
                    v_Total_Balance AS Total_Balance,
                    v_Monthly_Income AS Monthly_Income,
                    v_Monthly_Expense AS Monthly_Expense;
            END
        `);
        console.log("Procedure updated successfully.");
        process.exit();
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
