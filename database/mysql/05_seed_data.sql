-- ==========================================================
-- FINTRACK SEED DATA (Indian Context)
-- ==========================================================

USE fintrack_final;

-- 1. USERS
INSERT INTO USERS (Name, Email, Address, Occupation, Monthly_Income, Password, role) VALUES
('Rohan Sharma', 'rohan@example.com', 'Mumbai, India', 'Employee', 85000.00, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'USER'),
('Priya Verma', 'priya@example.com', 'Bangalore, India', 'Software Engineer', 120000.00, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'USER'),
('Admin User', 'admin@example.com', 'Admin Office', 'Administrator', 0, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'ADMIN');

-- 1.1 USER_PHONES
INSERT INTO USER_PHONES (User_ID, Phone_No, Is_Primary) VALUES
(1, '9876543210', TRUE),
(2, '9876500000', TRUE),
(3, '9999999999', TRUE);
INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES
(1, 'HDFC Salary Acct', 'Savings Bank', 50000.00),
(1, 'Paytm Wallet', 'Wallet', 2500.00),
(1, 'Cash in Hand', 'Cash', 5000.00);

-- 3. CATEGORIES (Standard)
INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES
(1, 'Salary', 'Income'),
(1, 'Rent', 'Expense'),
(1, 'Groceries', 'Expense'),
(1, 'Dining Out', 'Expense'),
(1, 'Transport', 'Expense'),
(1, 'Utilities', 'Expense');

-- 4. TRANSACTIONS (Testing the Flows)
-- Initial Salary
CALL sp_add_transaction(1, 1, 1, 85000, 'Income', 'Salary', 'February Salary Credited');

-- Paid Rent
CALL sp_add_transaction(1, 1, 2, 15000, 'Expense', 'Manual', 'Feb Rent Payment');

-- Grocery Shopping via Paytm
CALL sp_add_transaction(1, 2, 3, 1200, 'Expense', 'Manual', 'BigBasket Order');

-- 5. SAVINGS
INSERT INTO SAVINGS (User_ID, Goal_Title, Target_Amount, Start_Date) VALUES
(1, 'New MacBook', 150000, CURDATE());

-- 6. BUDGETs
INSERT INTO BUDGET (User_ID, Category_ID, Budget_Amount, Month_Year) VALUES
(1, 3, 5000, '2024-02'); -- 5000 Budget for Groceries
