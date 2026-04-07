DROP PROCEDURE IF EXISTS sp_get_user_financial_summary;

DELIMITER / /

CREATE PROCEDURE sp_get_user_financial_summary(
    IN p_User_ID INT,
    IN p_Month_Year VARCHAR(7)
)
BEGIN
    DECLARE v_Total_Balance DECIMAL(15, 2);
    DECLARE v_Monthly_Income DECIMAL(15, 2);
    DECLARE v_Monthly_Expense DECIMAL(15, 2);

    -- Calculate total balance across all accounts
    SELECT COALESCE(SUM(Balance), 0) INTO v_Total_Balance
    FROM ACCOUNT
    WHERE User_ID = p_User_ID;

    -- Calculate total income for the specific month
    SELECT COALESCE(SUM(Amount), 0) INTO v_Monthly_Income
    FROM `TRANSACTION`
    WHERE User_ID = p_User_ID 
      AND Transaction_Type = 'Income'
      AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

    -- Calculate total expense for the specific month (Excluding Budget/Goal Transfers)
    SELECT COALESCE(SUM(Amount), 0) INTO v_Monthly_Expense
    FROM `TRANSACTION`
    WHERE User_ID = p_User_ID 
      AND Transaction_Type = 'Expense'
      AND (Reference_Type IS NULL OR Reference_Type != 'Transfer')
      AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = p_Month_Year;

    -- Return the summary
    SELECT 
        v_Total_Balance AS Total_Balance,
        v_Monthly_Income AS Monthly_Income,
        v_Monthly_Expense AS Monthly_Expense;
END //

DELIMITER;