const db = require('./db');
const fixSavingsProc = async () => {
    try {
        await db.query(`DROP PROCEDURE IF EXISTS sp_add_to_savings_goal`);
        await db.query(`
            CREATE PROCEDURE sp_add_to_savings_goal(
                IN p_Goal_ID INT,
                IN p_Amount DECIMAL(15,2),
                IN p_Account_ID INT
            )
            BEGIN
                DECLARE v_Current_Amount DECIMAL(15,2);
                DECLARE v_Target_Amount DECIMAL(15,2);
                DECLARE v_Status ENUM('Active', 'Achieved');
                DECLARE v_User_ID INT;
                DECLARE v_Goal_Title VARCHAR(100);
                DECLARE v_Account_Balance DECIMAL(15,2);
                DECLARE v_Contribution_Amt DECIMAL(15,2);
                DECLARE v_Remaining DECIMAL(15,2);

                -- Retrieve goal data
                SELECT Current_Amount, Target_Amount, Status, User_ID, Goal_Title
                INTO v_Current_Amount, v_Target_Amount, v_Status, v_User_ID, v_Goal_Title
                FROM SAVINGS WHERE Goal_ID = p_Goal_ID FOR UPDATE;

                IF v_Status = 'Achieved' THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This savings goal is already achieved';
                END IF;

                SET v_Remaining = v_Target_Amount - v_Current_Amount;
                
                -- The contribution is the minimum of provided amount or remaining amount
                IF p_Amount > v_Remaining THEN
                    SET v_Contribution_Amt = v_Remaining;
                ELSE
                    SET v_Contribution_Amt = p_Amount;
                END IF;

                IF v_Contribution_Amt <= 0 THEN
                   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Goal is already fully funded';
                END IF;

                -- Check account
                SELECT Balance INTO v_Account_Balance FROM ACCOUNT WHERE Account_ID = p_Account_ID FOR UPDATE;
                IF v_Account_Balance IS NULL THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account not found';
                END IF;
                IF v_Account_Balance < v_Contribution_Amt THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds in selected account';
                END IF;

                -- Log Transaction (triggers will handle account balance deduction)
                INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                VALUES (v_User_ID, p_Account_ID, NULL, v_Contribution_Amt, 'Expense', 'Manual', CONCAT('Savings: ', v_Goal_Title), NOW());

                -- Update Goal Current_Amount
                SET v_Current_Amount = v_Current_Amount + v_Contribution_Amt;
                IF v_Current_Amount >= v_Target_Amount THEN
                    SET v_Status = 'Achieved';
                END IF;

                UPDATE SAVINGS 
                SET Current_Amount = v_Current_Amount, Status = v_Status
                WHERE Goal_ID = p_Goal_ID;
            END
        `);
        console.log('Fixed Savings SP!');
    } catch(e){
        console.error(e);
    } finally {
        process.exit();
    }
}
fixSavingsProc();
