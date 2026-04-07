-- ==========================================================
-- FINTRACK TRIGGERS
-- Automation for data consistency
-- ==========================================================

USE fintrack_db;

DELIMITER //

-- 1. UPDATE BALANCE AFTER TRANSACTION
-- Automatically adjusts account balance when a transaction occurs
CREATE TRIGGER trg_update_balance_after_transaction
AFTER INSERT ON TRANSACTION
FOR EACH ROW
BEGIN
    IF NEW.Transaction_Type = 'Income' THEN
        UPDATE ACCOUNT 
        SET Balance = Balance + NEW.Amount 
        WHERE Account_ID = NEW.Account_ID;
    ELSEIF NEW.Transaction_Type = 'Expense' THEN
        UPDATE ACCOUNT 
        SET Balance = Balance - NEW.Amount 
        WHERE Account_ID = NEW.Account_ID;
    END IF;
END //

-- 2. UPDATE SUMMARIES AFTER TRANSACTION
-- Automatically updates Monthly and Category summaries
CREATE TRIGGER trg_update_summaries_after_transaction
AFTER INSERT ON TRANSACTION
FOR EACH ROW
BEGIN
    DECLARE v_Month_Year VARCHAR(7);
    SET v_Month_Year = DATE_FORMAT(NEW.Transaction_DateTime, '%Y-%m');

    -- Update Monthly Summary
    INSERT INTO MONTHLY_SUMMARY (User_ID, Month_Year, Total_Income, Total_Expense, Total_EMI, Total_Savings)
    VALUES (NEW.User_ID, v_Month_Year, 
            IF(NEW.Transaction_Type='Income', NEW.Amount, 0),
            IF(NEW.Transaction_Type='Expense', NEW.Amount, 0),
            IF(NEW.Reference_Type='EMI', NEW.Amount, 0),
            IF(NEW.Transaction_Type='Income', NEW.Amount, -NEW.Amount))
    ON DUPLICATE KEY UPDATE
        Total_Income = Total_Income + IF(NEW.Transaction_Type='Income', NEW.Amount, 0),
        Total_Expense = Total_Expense + IF(NEW.Transaction_Type='Expense', NEW.Amount, 0),
        Total_EMI = Total_EMI + IF(NEW.Reference_Type='EMI', NEW.Amount, 0),
        Total_Savings = Total_Savings + IF(NEW.Transaction_Type='Income', NEW.Amount, -NEW.Amount);

    -- Update Category Summary (If Category is set)
    IF NEW.Category_ID IS NOT NULL THEN
        INSERT INTO CATEGORY_SUMMARY (User_ID, Category_ID, Month_Year, Total_Amount)
        VALUES (NEW.User_ID, NEW.Category_ID, v_Month_Year, NEW.Amount)
        ON DUPLICATE KEY UPDATE
            Total_Amount = Total_Amount + NEW.Amount;
    END IF;
END //

-- 3. AUDIT LOG FOR SENSITIVE CHANGES (USERS)
-- Tracks if a user changes their password
CREATE TRIGGER trg_audit_user_update
AFTER UPDATE ON USERS
FOR EACH ROW
BEGIN
    IF OLD.Password != NEW.Password THEN
        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
        VALUES ('USERS', 'UPDATE', OLD.User_ID, OLD.User_ID);
    END IF;
END //

-- 4. CHECK SAVINGS GOAL COMPLETION
-- When money is added to savings, check if goal is reached
CREATE TRIGGER trg_check_savings_goal
BEFORE UPDATE ON SAVINGS
FOR EACH ROW
BEGIN
    IF NEW.Current_Amount >= NEW.Target_Amount AND OLD.Status = 'Active' THEN
        SET NEW.Status = 'Achieved';
    END IF;
END //

DELIMITER ;
