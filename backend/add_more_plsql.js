const db = require('./db');

const addMorePLSQL = async () => {
    try {
        console.log('Adding more advanced PL/SQL Procedures and Triggers...');

        // 1. Procedure: sp_process_emi_payment
        // Automates EMI deduction, creates transaction, updates EMI status
        await db.query(`DROP PROCEDURE IF EXISTS sp_process_emi_payment`);
        await db.query(`
            CREATE PROCEDURE sp_process_emi_payment(
                IN p_EMI_ID INT,
                IN p_Description VARCHAR(255)
            )
            BEGIN
                DECLARE v_User_ID INT;
                DECLARE v_Account_ID INT;
                DECLARE v_Category_ID INT;
                DECLARE v_EMI_Amount DECIMAL(15,2);
                DECLARE v_Current_Balance DECIMAL(15,2);
                DECLARE v_Status VARCHAR(20);
                DECLARE v_End_Date DATE;
                
                -- Fetch EMI details
                SELECT User_ID, Account_ID, Category_ID, EMI_Amount, Status, End_Date 
                INTO v_User_ID, v_Account_ID, v_Category_ID, v_EMI_Amount, v_Status, v_End_Date
                FROM EMI 
                WHERE EMI_ID = p_EMI_ID;

                IF v_Status = 'Completed' THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EMI is already completed';
                END IF;

                -- Check Balance
                SELECT Balance INTO v_Current_Balance FROM ACCOUNT WHERE Account_ID = v_Account_ID;
                IF v_Current_Balance < v_EMI_Amount THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance for EMI payment';
                END IF;

                -- Start Transaction block
                START TRANSACTION;
                    
                    -- Insert the transaction (triggers will handle balance updates)
                    INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                    VALUES (v_User_ID, v_Account_ID, v_Category_ID, v_EMI_Amount, 'Expense', 'EMI', IFNULL(p_Description, 'Automated EMI Deduction'), NOW());
                    
                    -- Update EMI table
                    UPDATE EMI 
                    SET Last_Deducted = CURDATE(),
                        Status = IF(CURDATE() >= End_Date, 'Completed', 'Active')
                    WHERE EMI_ID = p_EMI_ID;

                COMMIT;
            END
        `);
        console.log('✅ sp_process_emi_payment procedure created.');

        // 2. Procedure: sp_process_salary_credit
        // Automates Salary credits, creates transaction, updates SALARY table
        await db.query(`DROP PROCEDURE IF EXISTS sp_process_salary_credit`);
        await db.query(`
            CREATE PROCEDURE sp_process_salary_credit(
                IN p_Salary_ID INT
            )
            BEGIN
                DECLARE v_User_ID INT;
                DECLARE v_Account_ID INT;
                DECLARE v_Category_ID INT;
                DECLARE v_Amount DECIMAL(15,2);
                DECLARE v_Status VARCHAR(20);

                -- Fetch Salary settings
                SELECT User_ID, Account_ID, Category_ID, Amount, Status 
                INTO v_User_ID, v_Account_ID, v_Category_ID, v_Amount, v_Status
                FROM SALARY 
                WHERE Salary_ID = p_Salary_ID;

                IF v_Status = 'Inactive' THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Salary record is inactive';
                END IF;

                START TRANSACTION;
                    
                    -- Insert Income transaction
                    INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                    VALUES (v_User_ID, v_Account_ID, v_Category_ID, v_Amount, 'Income', 'Salary', 'Automated Salary Credit', NOW());
                    
                    -- Update Last_Credited
                    UPDATE SALARY 
                    SET Last_Credited = NOW()
                    WHERE Salary_ID = p_Salary_ID;

                COMMIT;
            END
        `);
        console.log('✅ sp_process_salary_credit procedure created.');

        // 3. Trigger: trg_audit_budget_exceeded
        // Checks right after a transaction is added if the budget for that category is exceeded
        await db.query(`DROP TRIGGER IF EXISTS trg_audit_budget_exceeded`);
        await db.query(`
            CREATE TRIGGER trg_audit_budget_exceeded
            AFTER INSERT ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                DECLARE v_Budget_Amount DECIMAL(15,2);
                DECLARE v_Spent_Amount DECIMAL(15,2);
                DECLARE v_Month_Year VARCHAR(7);

                IF NEW.Transaction_Type = 'Expense' AND NEW.Category_ID IS NOT NULL THEN
                    SET v_Month_Year = DATE_FORMAT(NEW.Transaction_DateTime, '%Y-%m');

                    -- Get Budget Amount for this Category and Month
                    SELECT Budget_Amount INTO v_Budget_Amount
                    FROM BUDGET
                    WHERE User_ID = NEW.User_ID AND Category_ID = NEW.Category_ID AND Month_Year = v_Month_Year;

                    -- Get Total Spent Amount for this Category and Month (INCLUDING the new transaction, since it was just inserted)
                    SELECT SUM(Amount) INTO v_Spent_Amount
                    FROM \`TRANSACTION\`
                    WHERE User_ID = NEW.User_ID AND Category_ID = NEW.Category_ID 
                      AND Transaction_Type = 'Expense' 
                      AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = v_Month_Year;

                    -- If Budget exists and spent exceeds budget, log it in AUDIT_LOG
                    IF v_Budget_Amount IS NOT NULL AND v_Spent_Amount > v_Budget_Amount THEN
                        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Transaction_ID)
                        VALUES ('BUDGET_ALERT', 'UPDATE', NEW.Category_ID, NEW.User_ID, NEW.Transaction_ID);
                    END IF;
                END IF;
            END
        `);
        console.log('✅ trg_audit_budget_exceeded trigger created.');

        // 4. Procedure: sp_get_user_financial_summary
        // A single stored procedure to return all high-level stats for the Dashboard
        await db.query(`DROP PROCEDURE IF EXISTS sp_get_user_financial_summary`);
        await db.query(`
            CREATE PROCEDURE sp_get_user_financial_summary(
                IN p_User_ID INT,
                IN p_Month_Year VARCHAR(7)
            )
            BEGIN
                DECLARE v_Total_Balance DECIMAL(15,2) DEFAULT 0;
                DECLARE v_Total_Income DECIMAL(15,2) DEFAULT 0;
                DECLARE v_Total_Expense DECIMAL(15,2) DEFAULT 0;
                DECLARE v_Monthly_Income DECIMAL(15,2) DEFAULT 0;
                DECLARE v_Monthly_Expense DECIMAL(15,2) DEFAULT 0;

                -- Total Account Balance
                SELECT IFNULL(SUM(Balance), 0) INTO v_Total_Balance
                FROM ACCOUNT WHERE User_ID = p_User_ID;

                -- All-time Income/Expense
                SELECT 
                    IFNULL(SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END), 0),
                    IFNULL(SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END), 0)
                INTO v_Total_Income, v_Total_Expense
                FROM \`TRANSACTION\` WHERE User_ID = p_User_ID;

                -- Monthly Income/Expense for the specific Month_Year
                SELECT 
                    IFNULL(SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END), 0),
                    IFNULL(SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END), 0)
                INTO v_Monthly_Income, v_Monthly_Expense
                FROM \`TRANSACTION\` 
                WHERE User_ID = p_User_ID 
                  AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

                -- Return result set
                SELECT 
                    v_Total_Balance AS Total_Balance,
                    v_Total_Income AS Total_Income,
                    v_Total_Expense AS Total_Expense,
                    v_Monthly_Income AS Monthly_Income,
                    v_Monthly_Expense AS Monthly_Expense;
            END
        `);
        console.log('✅ sp_get_user_financial_summary procedure created.');

        // 5. Trigger: trg_audit_account_delete
        // Audit log when an account is deleted completely
        await db.query(`DROP TRIGGER IF EXISTS trg_audit_account_delete`);
        await db.query(`
            CREATE TRIGGER trg_audit_account_delete
            AFTER DELETE ON ACCOUNT
            FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
                VALUES ('ACCOUNT', 'DELETE', OLD.Account_ID, OLD.User_ID);
            END
        `);
        console.log('✅ trg_audit_account_delete trigger created.');

        console.log('🎉 Advanced PL/SQL setup completed!');

    } catch (err) {
        console.error('Failed to add PL/SQL procedures and triggers:', err);
    } finally {
        process.exit();
    }
};

addMorePLSQL();
