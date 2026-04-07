-- ==========================================================
-- FINTRACK VIEWS
-- Simplified virtual tables for Reporting
-- ==========================================================

USE fintrack_db;

-- 1. USER TRANSACTION HISTORY
-- Human-readable format with names instead of IDs
CREATE OR REPLACE VIEW vw_user_transaction_history AS
SELECT 
    t.Transaction_ID,
    u.Name AS User_Name,
    a.Account_Name,
    c.Category_Name,
    t.Amount,
    t.Transaction_Type,
    t.Reference_Type,
    t.Description,
    t.Transaction_DateTime
FROM TRANSACTION_LOG t
JOIN USERS u ON t.User_ID = u.User_ID
JOIN ACCOUNT a ON t.Account_ID = a.Account_ID
LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
ORDER BY t.Transaction_DateTime DESC;

-- 2. MONTHLY SPENDING BY CATEGORY
-- Excellent for charts (Pie Chart logic)
CREATE OR REPLACE VIEW vw_monthly_category_spend AS
SELECT 
    User_ID,
    Category_ID,
    DATE_FORMAT(Transaction_DateTime, '%Y-%m') AS Month_Year,
    SUM(Amount) AS Total_Spent
FROM TRANSACTION_LOG
WHERE Transaction_Type = 'Expense'
GROUP BY User_ID, Category_ID, Month_Year;

-- 3. CURRENT FINANCIAL STATUS
-- Snapshot of Total Assets vs Total Debts (if we track debts) per user
CREATE OR REPLACE VIEW vw_account_status AS
SELECT 
    User_ID,
    COUNT(Account_ID) AS Total_Accounts,
    SUM(Balance) AS Net_Worth
FROM ACCOUNT
GROUP BY User_ID;
