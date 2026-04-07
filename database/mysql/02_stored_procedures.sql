-- ==========================================================
-- FINTRACK STORED PROCEDURES (PL/SQL)
-- ==========================================================

USE fintrack_final;

DELIMITER //

-- 1. REGISTER USER
-- Safely inserts a new user
CREATE PROCEDURE sp_register_user(
    IN p_Name VARCHAR(100),
    IN p_Email VARCHAR(100),
    IN p_Phone VARCHAR(20),
    IN p_Address TEXT,
    IN p_Occupation VARCHAR(50),
    IN p_Monthly_Income DECIMAL(15,2),
    IN p_Password VARCHAR(255)
)
BEGIN
    INSERT INTO USERS (Name, Email, Phone_No, Address, Occupation, Monthly_Income, Password, Last_Login)
    VALUES (p_Name, p_Email, p_Phone, p_Address, p_Occupation, p_Monthly_Income, p_Password, NOW());
END //

-- 2. ADD TRANSACTION (Main Logic)
-- Inserts transaction, Balance update is handled by Trigger
CREATE PROCEDURE sp_add_transaction(
    IN p_User_ID INT,
    IN p_Account_ID INT,
    IN p_Category_ID INT,
    IN p_Amount DECIMAL(15,2),
    IN p_Transaction_Type VARCHAR(10),
    IN p_Reference_Type VARCHAR(20),
    IN p_Description VARCHAR(255)
)
BEGIN
    DECLARE v_Current_Balance DECIMAL(15,2);
    
    -- Check if account belongs to user
    IF NOT EXISTS (SELECT 1 FROM ACCOUNT WHERE Account_ID = p_Account_ID AND User_ID = p_User_ID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account does not belong to user';
    END IF;

    -- Basic Validation for Expense
    IF p_Transaction_Type = 'Expense' THEN
        SELECT Balance INTO v_Current_Balance FROM ACCOUNT WHERE Account_ID = p_Account_ID;
        IF v_Current_Balance < p_Amount THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds in the selected account';
        END IF;
    END IF;

    -- Insert Transaction
    INSERT INTO TRANSACTION (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
    VALUES (p_User_ID, p_Account_ID, p_Category_ID, p_Amount, p_Transaction_Type, p_Reference_Type, p_Description, NOW());
END //

-- 3. FUND TRANSFER
-- Atomic transaction to move money between accounts
CREATE PROCEDURE sp_fund_transfer(
    IN p_User_ID INT,
    IN p_From_Account_ID INT,
    IN p_To_Account_ID INT,
    IN p_Amount DECIMAL(15,2)
)
BEGIN
    DECLARE v_From_Balance DECIMAL(15,2);
    
    -- Validate ownership
    IF NOT EXISTS (SELECT 1 FROM ACCOUNT WHERE Account_ID = p_From_Account_ID AND User_ID = p_User_ID) OR
       NOT EXISTS (SELECT 1 FROM ACCOUNT WHERE Account_ID = p_To_Account_ID AND User_ID = p_User_ID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'One or both accounts do not belong to the user';
    END IF;

    -- Validate Balance
    SELECT Balance INTO v_From_Balance FROM ACCOUNT WHERE Account_ID = p_From_Account_ID;
    
    IF v_From_Balance < p_Amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance in source account';
    END IF;

    -- Start Transaction
    START TRANSACTION;

        -- Record Transfer
        INSERT INTO TRANSFER (From_Account_ID, To_Account_ID, Amount, Transfer_DateTime)
        VALUES (p_From_Account_ID, p_To_Account_ID, p_Amount, NOW());

        -- Record as Expense in From Account
        INSERT INTO TRANSACTION (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Transaction_DateTime)
        VALUES (p_User_ID, p_From_Account_ID, p_Amount, 'Expense', 'Transfer', NOW());

        -- Record as Income in To Account
        INSERT INTO TRANSACTION (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Transaction_DateTime)
        VALUES (p_User_ID, p_To_Account_ID, p_Amount, 'Income', 'Transfer', NOW());

    COMMIT;
END //

-- 4. SEARCH TRANSACTIONS
-- Dynamic search with filters
CREATE PROCEDURE sp_search_transactions(
    IN p_User_ID INT,
    IN p_Start_Date DATE,
    IN p_End_Date DATE,
    IN p_Category_ID INT,
    IN p_Transaction_Type VARCHAR(10)
)
BEGIN
    SELECT 
        T.Transaction_ID,
        T.Amount,
        T.Transaction_Type,
        C.Category_Name,
        A.Account_Name,
        T.Transaction_DateTime
    FROM TRANSACTION T
    LEFT JOIN CATEGORY C ON T.Category_ID = C.Category_ID
    JOIN ACCOUNT A ON T.Account_ID = A.Account_ID
    WHERE T.User_ID = p_User_ID
      AND (p_Start_Date IS NULL OR DATE(T.Transaction_DateTime) >= p_Start_Date)
      AND (p_End_Date IS NULL OR DATE(T.Transaction_DateTime) <= p_End_Date)
      AND (p_Category_ID IS NULL OR T.Category_ID = p_Category_ID)
      AND (p_Transaction_Type IS NULL OR T.Transaction_Type = p_Transaction_Type)
    ORDER BY T.Transaction_DateTime DESC;
END //

-- 5. UPDATE TRANSACTION
-- Allows updating the amount or category of a transaction
CREATE PROCEDURE sp_update_transaction(
    IN p_Tx_ID INT,
    IN p_User_ID INT,
    IN p_New_Amount DECIMAL(15,2),
    IN p_New_Category_ID INT
)
BEGIN
    DECLARE v_Old_Amount DECIMAL(15,2);
    DECLARE v_Tx_Type VARCHAR(10);
    DECLARE v_Acc_ID INT;

    -- Validate ownership
    IF NOT EXISTS (SELECT 1 FROM TRANSACTION WHERE Transaction_ID = p_Tx_ID AND User_ID = p_User_ID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unauthorized to update this transaction';
    END IF;

    -- Update handling is automatically adjusted by the AFTER UPDATE trigger on Table
    UPDATE TRANSACTION 
    SET Amount = p_New_Amount, Category_ID = p_New_Category_ID 
    WHERE Transaction_ID = p_Tx_ID;
END //

-- 6. DELETE TRANSACTION
-- Safely removes a transaction and adjusts balance via Trigger
CREATE PROCEDURE sp_delete_transaction(
    IN p_Tx_ID INT,
    IN p_User_ID INT
)
BEGIN
    -- Validate ownership
    IF NOT EXISTS (SELECT 1 FROM TRANSACTION WHERE Transaction_ID = p_Tx_ID AND User_ID = p_User_ID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unauthorized to delete this transaction';
    END IF;

    DELETE FROM TRANSACTION WHERE Transaction_ID = p_Tx_ID;
END //

-- 7. ADD CONTRIBUTION TO SAVINGS GOAL
CREATE PROCEDURE sp_add_to_savings_goal(
    IN p_Goal_ID INT,
    IN p_Amount DECIMAL(15,2),
    IN p_Account_ID INT
)
BEGIN
    DECLARE v_User_ID INT;
    DECLARE v_Target DECIMAL(15,2);
    DECLARE v_Current DECIMAL(15,2);

    -- Get Goal Stats
    SELECT User_ID, Target_Amount, Current_Amount INTO v_User_ID, v_Target, v_Current
    FROM SAVINGS WHERE Goal_ID = p_Goal_ID;

    IF v_Target IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Savings goal not found';
    END IF;

    IF v_Current >= v_Target THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Goal already achieved';
    END IF;

    -- Standard Transaction (Deducts Account Balance via Trigger)
    CALL sp_add_transaction(
        v_User_ID, p_Account_ID, NULL, p_Amount, 'Expense', 'Manual', 'Savings Goal Contribution'
    );

    -- Update Savings Goal
    UPDATE SAVINGS 
    SET Current_Amount = Current_Amount + p_Amount 
    WHERE Goal_ID = p_Goal_ID;
    
    -- Log EMI record
    INSERT INTO SAVINGS_EMI_HISTORY (Goal_ID, Amount, Account_ID, Status)
    VALUES (p_Goal_ID, p_Amount, p_Account_ID, 'Success');

END //

-- 8. PROCESS EMI PAYMENT (Deducts balance and adds transaction)
CREATE PROCEDURE sp_process_emi_payment(
    IN p_EMI_ID INT,
    IN p_Description VARCHAR(255)
)
BEGIN
    DECLARE v_Amount DECIMAL(15,2);
    DECLARE v_User_ID INT;
    DECLARE v_Acc_ID INT;
    DECLARE v_Cat_ID INT;

    SELECT User_ID, Account_ID, Category_ID, EMI_Amount INTO v_User_ID, v_Acc_ID, v_Cat_ID, v_Amount
    FROM EMI WHERE EMI_ID = p_EMI_ID;

    IF v_User_ID IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EMI record not found';
    END IF;

    -- Standard Transaction (Deducts Account Balance via Trigger)
    CALL sp_add_transaction(
        v_User_ID, v_Acc_ID, v_Cat_ID, v_Amount, 'Expense', 'EMI', p_Description
    );

    -- Update EMI Record
    UPDATE EMI SET Last_Deducted = NOW() WHERE EMI_ID = p_EMI_ID;
END //

-- 9. GET USER FINANCIAL SUMMARY (For Dashboard / MongoDB Snapshots)
-- Excludes internal budget/goal transfers to give true cash-flow net savings
CREATE PROCEDURE sp_get_user_financial_summary(
    IN p_User_ID INT,
    IN p_Month_Year VARCHAR(7)
)
BEGIN
    DECLARE v_Total_Balance DECIMAL(15, 2);
    DECLARE v_Monthly_Income DECIMAL(15, 2);
    DECLARE v_Monthly_Expense DECIMAL(15, 2);

    SELECT COALESCE(SUM(Balance), 0) INTO v_Total_Balance
    FROM ACCOUNT WHERE User_ID = p_User_ID;

    SELECT COALESCE(SUM(Amount), 0) INTO v_Monthly_Income
    FROM `TRANSACTION`
    WHERE User_ID = p_User_ID
      AND Transaction_Type = 'Income'
      AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

    SELECT COALESCE(SUM(Amount), 0) INTO v_Monthly_Expense
    FROM `TRANSACTION`
    WHERE User_ID = p_User_ID
      AND Transaction_Type = 'Expense'
      AND (Reference_Type IS NULL OR Reference_Type != 'Transfer')
      AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

    SELECT
        v_Total_Balance   AS Total_Balance,
        v_Monthly_Income  AS Monthly_Income,
        v_Monthly_Expense AS Monthly_Expense,
        (v_Monthly_Income - v_Monthly_Expense) AS Net_Savings;
END //

-- 10. PROCESS SALARY CREDIT
CREATE PROCEDURE sp_process_salary(
    IN p_Salary_ID INT
)
BEGIN
    DECLARE v_Amount   DECIMAL(15,2);
    DECLARE v_User_ID  INT;
    DECLARE v_Acc_ID   INT;
    DECLARE v_Cat_ID   INT;

    SELECT User_ID, Account_ID, Category_ID, Amount
    INTO v_User_ID, v_Acc_ID, v_Cat_ID, v_Amount
    FROM SALARY WHERE Salary_ID = p_Salary_ID;

    IF v_User_ID IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Salary record not found';
    END IF;

    CALL sp_add_transaction(
        v_User_ID, v_Acc_ID, v_Cat_ID, v_Amount, 'Income', 'Salary', 'Monthly Salary Credit'
    );

    UPDATE SALARY SET Last_Credited = NOW() WHERE Salary_ID = p_Salary_ID;
END //

-- 11. GET BUDGET STATUS
-- Returns budget utilisation for all active budgets of a user
CREATE PROCEDURE sp_get_budget_status(
    IN p_User_ID INT
)
BEGIN
    SELECT
        b.Budget_ID,
        b.Budget_Name,
        b.Total_Budget_Amount                                    AS Total,
        b.Remaining_Budget_Amount                                AS Remaining,
        (b.Total_Budget_Amount - b.Remaining_Budget_Amount)      AS Spent,
        ROUND(
            (b.Total_Budget_Amount - b.Remaining_Budget_Amount)
            / NULLIF(b.Total_Budget_Amount, 0) * 100, 2
        )                                                        AS Utilisation_Pct,
        b.Status,
        a.Account_Name                                           AS Source_Account
    FROM BUDGET_V2 b
    JOIN ACCOUNT a ON b.Source_Account_ID = a.Account_ID
    WHERE b.User_ID = p_User_ID
    ORDER BY FIELD(b.Status, 'Active', 'Completed', 'Deleted'), b.Created_At DESC;
END //

-- 12. TOP SPENDING CATEGORIES
-- Returns top N expense categories for a user in a given month
CREATE PROCEDURE sp_top_spending_categories(
    IN p_User_ID    INT,
    IN p_Month_Year VARCHAR(7),
    IN p_Limit      INT
)
BEGIN
    SELECT
        c.Category_Name,
        COUNT(t.Transaction_ID)          AS Transaction_Count,
        ROUND(SUM(t.Amount), 2)          AS Total_Spent,
        ROUND(AVG(t.Amount), 2)          AS Avg_Per_Transaction,
        MAX(t.Amount)                    AS Largest_Expense
    FROM `TRANSACTION` t
    JOIN CATEGORY c ON t.Category_ID = c.Category_ID
    WHERE t.User_ID = p_User_ID
      AND t.Transaction_Type = 'Expense'
      AND (t.Reference_Type IS NULL OR t.Reference_Type != 'Transfer')
      AND DATE_FORMAT(t.Transaction_DateTime, '%Y-%m') = p_Month_Year
    GROUP BY c.Category_ID, c.Category_Name
    ORDER BY Total_Spent DESC
    LIMIT p_Limit;
END //

-- 13. MONTHLY SPENDING TREND
-- Month-by-month income vs expense for last N months
CREATE PROCEDURE sp_monthly_trend(
    IN p_User_ID INT,
    IN p_Months  INT
)
BEGIN
    SELECT
        DATE_FORMAT(Transaction_DateTime, '%Y-%m')          AS Month,
        ROUND(SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END), 2)  AS Income,
        ROUND(SUM(CASE WHEN Transaction_Type = 'Expense'
                        AND (Reference_Type IS NULL OR Reference_Type != 'Transfer')
                       THEN Amount ELSE 0 END), 2)          AS Expense,
        ROUND(
            SUM(CASE WHEN Transaction_Type = 'Income'  THEN Amount ELSE 0 END) -
            SUM(CASE WHEN Transaction_Type = 'Expense'
                          AND (Reference_Type IS NULL OR Reference_Type != 'Transfer')
                         THEN Amount ELSE 0 END), 2
        )                                                   AS Net_Savings
    FROM `TRANSACTION`
    WHERE User_ID = p_User_ID
      AND Transaction_DateTime >= DATE_SUB(NOW(), INTERVAL p_Months MONTH)
    GROUP BY Month
    ORDER BY Month DESC;
END //

-- 14. ACCOUNT SUMMARY
-- Balance, transaction count, income and expense per account
CREATE PROCEDURE sp_account_summary(
    IN p_User_ID INT
)
BEGIN
    SELECT
        a.Account_ID,
        a.Account_Name,
        a.Account_Type,
        a.Balance                                                  AS Current_Balance,
        COUNT(t.Transaction_ID)                                    AS Total_Transactions,
        ROUND(SUM(CASE WHEN t.Transaction_Type = 'Income'  THEN t.Amount ELSE 0 END), 2) AS Total_Received,
        ROUND(SUM(CASE WHEN t.Transaction_Type = 'Expense' THEN t.Amount ELSE 0 END), 2) AS Total_Spent
    FROM ACCOUNT a
    LEFT JOIN `TRANSACTION` t ON a.Account_ID = t.Account_ID
    WHERE a.User_ID = p_User_ID
    GROUP BY a.Account_ID, a.Account_Name, a.Account_Type, a.Balance
    ORDER BY a.Balance DESC;
END //

-- 15. SAVINGS GOAL PROGRESS
-- Returns progress % for every savings goal of a user
CREATE PROCEDURE sp_savings_goal_progress(
    IN p_User_ID INT
)
BEGIN
    SELECT
        s.Goal_ID,
        s.Goal_Title,
        s.Target_Amount,
        s.Current_Amount,
        ROUND(s.Current_Amount / NULLIF(s.Target_Amount, 0) * 100, 2) AS Progress_Pct,
        s.Target_Date,
        DATEDIFF(s.Target_Date, CURDATE())                             AS Days_Remaining,
        s.Status,
        a.Account_Name
    FROM SAVINGS s
    LEFT JOIN ACCOUNT a ON s.Account_ID = a.Account_ID
    WHERE s.User_ID = p_User_ID
    ORDER BY Progress_Pct DESC;
END //

-- 16. NET WORTH STATEMENT
-- Summarises assets (account balances) vs liabilities (outstanding EMIs)
CREATE PROCEDURE sp_net_worth_statement(
    IN p_User_ID INT
)
BEGIN
    DECLARE v_Total_Assets      DECIMAL(15,2);
    DECLARE v_Total_Liabilities DECIMAL(15,2);

    SELECT COALESCE(SUM(Balance), 0)
    INTO v_Total_Assets
    FROM ACCOUNT WHERE User_ID = p_User_ID;

    SELECT COALESCE(SUM(Outstanding_Amount), 0)
    INTO v_Total_Liabilities
    FROM EMI WHERE User_ID = p_User_ID AND Status = 'Active';

    SELECT
        v_Total_Assets                              AS Total_Assets,
        v_Total_Liabilities                         AS Total_Liabilities,
        (v_Total_Assets - v_Total_Liabilities)      AS Net_Worth;
END //

-- 17. ADVANCED TRANSACTION SEARCH WITH AGGREGATION
-- Filters by multiple optional criteria and returns aggregated totals
CREATE PROCEDURE sp_advanced_search(
    IN p_User_ID         INT,
    IN p_Start_Date      DATE,
    IN p_End_Date        DATE,
    IN p_Category_ID     INT,
    IN p_Transaction_Type VARCHAR(10),
    IN p_Min_Amount      DECIMAL(15,2),
    IN p_Max_Amount      DECIMAL(15,2)
)
BEGIN
    SELECT
        t.Transaction_ID,
        t.Transaction_DateTime,
        t.Amount,
        t.Transaction_Type,
        t.Description,
        t.Reference_Type,
        c.Category_Name,
        a.Account_Name
    FROM `TRANSACTION` t
    LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
    JOIN ACCOUNT a ON t.Account_ID = a.Account_ID
    WHERE t.User_ID = p_User_ID
      AND (p_Start_Date       IS NULL OR DATE(t.Transaction_DateTime) >= p_Start_Date)
      AND (p_End_Date         IS NULL OR DATE(t.Transaction_DateTime) <= p_End_Date)
      AND (p_Category_ID      IS NULL OR t.Category_ID = p_Category_ID)
      AND (p_Transaction_Type IS NULL OR t.Transaction_Type = p_Transaction_Type)
      AND (p_Min_Amount       IS NULL OR t.Amount >= p_Min_Amount)
      AND (p_Max_Amount       IS NULL OR t.Amount <= p_Max_Amount)
    ORDER BY t.Transaction_DateTime DESC;
END //

-- 18. PURGE OLD TRANSACTIONS (Housekeeping)
-- Archive-deletes transactions older than N months for a given user
CREATE PROCEDURE sp_purge_old_transactions(
    IN p_User_ID INT,
    IN p_Months  INT
)
BEGIN
    DECLARE v_Cutoff DATE;
    SET v_Cutoff = DATE_SUB(CURDATE(), INTERVAL p_Months MONTH);

    DELETE FROM `TRANSACTION`
    WHERE User_ID = p_User_ID
      AND DATE(Transaction_DateTime) < v_Cutoff;

    SELECT ROW_COUNT() AS Rows_Purged;
END //

DELIMITER ;
