-- =============================================
-- FINTRACK - PL/SQL AUTOMATION
-- =============================================

-- 1. TRIGGER: Auto-Update Balance on Transaction
-- When a transaction is inserted, update the corresponding Account Balance.
CREATE OR REPLACE TRIGGER trg_update_balance
AFTER INSERT ON TRANSACTION
FOR EACH ROW
BEGIN
    IF :NEW.Transaction_Type = 'Income' THEN
        UPDATE ACCOUNT
        SET Balance = Balance + :NEW.Amount
        WHERE Account_ID = :NEW.Account_ID;
    ELSIF :NEW.Transaction_Type = 'Expense' THEN
        UPDATE ACCOUNT
        SET Balance = Balance - :NEW.Amount
        WHERE Account_ID = :NEW.Account_ID;
    END IF;
END;
/

-- 2. PROCEDURE: Process Salary Credit
-- Links SALARY_CREDIT insertion to TRANSACTION creation, which then triggers balance update.
CREATE OR REPLACE PROCEDURE proc_process_salary(
    p_user_id IN NUMBER,
    p_account_id IN NUMBER,
    p_amount IN NUMBER,
    p_month IN VARCHAR2,
    p_source IN VARCHAR2
)
IS
    v_salary_cat_id NUMBER;
    v_tx_id NUMBER;
BEGIN
    -- 1. Insert into SALARY_CREDIT log
    INSERT INTO SALARY_CREDIT (Salary_ID, User_ID, Account_ID, Credit_Amount, Credit_Month, Credit_Date, Source)
    VALUES (seq_tx_id.NEXTVAL, p_user_id, p_account_id, p_amount, p_month, SYSDATE, p_source);

    -- 2. Find or Create 'Salary' Category
    BEGIN
        SELECT Category_ID INTO v_salary_cat_id FROM CATEGORY 
        WHERE User_ID = p_user_id AND Category_Name = 'Salary' AND Category_Type = 'Income';
    EXCEPTION WHEN NO_DATA_FOUND THEN
        INSERT INTO CATEGORY (Category_ID, User_ID, Category_Name, Category_Type)
        VALUES (seq_tx_id.NEXTVAL, p_user_id, 'Salary', 'Income')
        RETURNING Category_ID INTO v_salary_cat_id;
    END;

    -- 3. Create Transaction (Triggers balance update)
    INSERT INTO TRANSACTION (Transaction_ID, User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Transaction_DateTime)
    VALUES (seq_tx_id.NEXTVAL, p_user_id, p_account_id, v_salary_cat_id, p_amount, 'Income', 'Salary', SYSTIMESTAMP);
    
    COMMIT;
END;
/

-- 3. TRIGGER: Prevent Over-Withdrawal for Savings (Emergency)
-- Ensures withdrawal doesn't exceed current goal amount.
CREATE OR REPLACE TRIGGER trg_check_savings_withdrawal
BEFORE INSERT ON EMERGENCY_WITHDRAWAL
FOR EACH ROW
DECLARE
    v_current_amt NUMBER;
BEGIN
    SELECT Current_Amount INTO v_current_amt FROM SAVINGS WHERE Goal_ID = :NEW.Goal_ID;
    
    IF :NEW.Withdraw_Amount > v_current_amt THEN
        RAISE_APPLICATION_ERROR(-20002, 'Insufficient funds in Savings Goal for this withdrawal.');
    END IF;
    
    -- Deduct from Savings
    UPDATE SAVINGS 
    SET Current_Amount = Current_Amount - :NEW.Withdraw_Amount
    WHERE Goal_ID = :NEW.Goal_ID;
END;
/

-- 4. FUNCTION: Calculate Net Savings for a Month
CREATE OR REPLACE FUNCTION func_calculate_net_savings(
    p_user_id IN NUMBER,
    p_month_year IN VARCHAR2 -- Format 'YYYY-MM'
) RETURN NUMBER IS
    v_income NUMBER := 0;
    v_expense NUMBER := 0;
BEGIN
    SELECT COALESCE(SUM(Amount), 0) INTO v_income
    FROM TRANSACTION
    WHERE User_ID = p_user_id 
      AND Transaction_Type = 'Income'
      AND TO_CHAR(Transaction_DateTime, 'YYYY-MM') = p_month_year;

    SELECT COALESCE(SUM(Amount), 0) INTO v_expense
    FROM TRANSACTION
    WHERE User_ID = p_user_id 
      AND Transaction_Type = 'Expense'
      AND TO_CHAR(Transaction_DateTime, 'YYYY-MM') = p_month_year;

    RETURN v_income - v_expense;
END;
/
