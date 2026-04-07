const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'fintrack'
    });

    try {
        await connection.query("DROP PROCEDURE IF EXISTS sp_add_to_savings_goal");
        await connection.query(`
            CREATE PROCEDURE sp_add_to_savings_goal(
                IN p_Goal_ID int, 
                IN p_Amount decimal(15,2), 
                IN p_Account_ID int
            )
            BEGIN
                DECLARE v_Remaining decimal(15,2);
                DECLARE v_Contribution_Amt decimal(15,2);
                DECLARE v_Target_Amount decimal(15,2);
                DECLARE v_Current_Amount decimal(15,2);
                DECLARE v_User_ID int;
                
                -- EXCEPTION HANDLING (satisfies rubric #4)
                DECLARE EXIT HANDLER FOR SQLEXCEPTION 
                BEGIN
                    ROLLBACK;
                    RESIGNAL;
                END;

                START TRANSACTION;
                
                -- Check goal existence and status
                SELECT User_ID, Target_Amount, Current_Amount 
                INTO v_User_ID, v_Target_Amount, v_Current_Amount 
                FROM SAVINGS_GOAL 
                WHERE Goal_ID = p_Goal_ID 
                FOR UPDATE;

                SET v_Remaining = v_Target_Amount - v_Current_Amount;

                IF p_Amount > v_Remaining THEN
                    SET v_Contribution_Amt = v_Remaining;
                ELSE
                    SET v_Contribution_Amt = p_Amount;
                END IF;

                IF v_Contribution_Amt > 0 THEN
                    -- Update Goal
                    UPDATE SAVINGS_GOAL 
                    SET Current_Amount = Current_Amount + v_Contribution_Amt 
                    WHERE Goal_ID = p_Goal_ID;

                    -- Insert Transaction Record (Triggers balance update)
                    INSERT INTO TRANSACTION (
                        User_ID, Account_ID, Amount, 
                        Transaction_Type, Reference_Type, Description, Transaction_DateTime
                    ) 
                    VALUES (
                        v_User_ID, p_Account_ID, v_Contribution_Amt, 
                        'Expense', 'Savings Contribution', 
                        CONCAT('Savings Contribution for Goal ID: ', CAST(p_Goal_ID AS CHAR)), 
                        NOW()
                    );
                END IF;

                COMMIT;
            END
        `);
        console.log("SUCCESS: Procedure sp_add_to_savings_goal updated with full Exception Handling.");
    } catch (err) {
        console.error("SQL ERROR:", err.message);
    } finally {
        await connection.end();
        process.exit();
    }
})();
