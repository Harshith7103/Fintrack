-- ==========================================================
-- FINTRACK DATABASE MASTER SCRIPT (MySQL)
-- Author: FinTrack Dev Team
-- Context: DBMS Project - Indian Rupees
-- Includes: Tables, Procedures, Triggers, Views, Seed Data
-- ==========================================================

DROP DATABASE IF EXISTS fintrack_final;

CREATE DATABASE fintrack_final;

USE fintrack_final;

-- ==========================================================
-- 1. TABLE DEFINITIONS
-- ==========================================================

-- 1. USERS TABLE
CREATE TABLE USERS (
    User_ID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Address TEXT,
    Occupation VARCHAR(100) DEFAULT 'Student',
    Monthly_Income DECIMAL(15, 2) DEFAULT 0.00 CHECK (Monthly_Income >= 0),
    Password VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    Account_Status ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
    Last_Login DATETIME,
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1.1 USER_PHONES TABLE (Multivalued Attribute)
CREATE TABLE USER_PHONES (
    Phone_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Phone_No VARCHAR(20) NOT NULL CHECK (LENGTH(Phone_No) >= 10),
    Is_Primary BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    UNIQUE (User_ID, Phone_No)
);

-- 2. ACCOUNT TABLE
CREATE TABLE ACCOUNT (
    Account_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Account_Name VARCHAR(100) NOT NULL, -- e.g., 'SBI Savings', 'Cash'
    Account_Type ENUM(
        'Cash',
        'Bank',
        'Wallet',
        'Credit Card'
    ) NOT NULL,
    Balance DECIMAL(15, 2) DEFAULT 0.00,
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    CHECK (
        Account_Type IN ('Bank', 'Credit Card')
        OR Balance >= 0
    ) -- Cash/Wallet cannot be negative
);

-- 3. CATEGORY TABLE
CREATE TABLE CATEGORY (
    Category_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Category_Name VARCHAR(50) NOT NULL, -- e.g., 'Food', 'Travel'
    Category_Type ENUM('Income', 'Expense') NOT NULL,
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE
);

-- 4. TRANSACTION TABLE (Main Table)
CREATE TABLE TRANSACTION (
    Transaction_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Account_ID INT NOT NULL,
    Category_ID INT,
    Amount DECIMAL(15, 2) NOT NULL CHECK (Amount > 0),
    Transaction_Type ENUM('Income', 'Expense') NOT NULL,
    Reference_Type ENUM(
        'Manual',
        'EMI',
        'Transfer',
        'Salary',
        'Bill'
    ) DEFAULT 'Manual',
    Description VARCHAR(255), -- Added for better tracking
    fraud_status ENUM('Safe', 'Suspicious', 'Fraud') DEFAULT 'Safe',
    risk_score INT DEFAULT 0,
    Transaction_DateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE CASCADE,
    FOREIGN KEY (Category_ID) REFERENCES CATEGORY (Category_ID) ON DELETE SET NULL
);

-- 5. TRANSFER TABLE
CREATE TABLE TRANSFER (
    Transfer_ID INT AUTO_INCREMENT PRIMARY KEY,
    From_Account_ID INT NOT NULL,
    To_Account_ID INT NOT NULL,
    Amount DECIMAL(15, 2) NOT NULL CHECK (Amount > 0),
    Transfer_DateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (From_Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE CASCADE,
    FOREIGN KEY (To_Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE CASCADE,
    CHECK (
        From_Account_ID != To_Account_ID
    )
);

-- 6. SAVINGS TABLE
CREATE TABLE SAVINGS (
    Goal_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Goal_Title VARCHAR(100) NOT NULL,
    Target_Amount DECIMAL(15, 2) NOT NULL CHECK (Target_Amount > 0),
    Current_Amount DECIMAL(15, 2) DEFAULT 0.00,
    Start_Date DATE NOT NULL,
    Target_Date DATE,
    Status ENUM('Active', 'Achieved') DEFAULT 'Active',
    -- EMI Features
    EMI_Enabled BOOLEAN DEFAULT FALSE,
    EMI_Amount DECIMAL(15, 2),
    EMI_Date INT CHECK (EMI_Date BETWEEN 1 AND 31),
    Account_ID INT, -- Account to deduct EMI from
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE SET NULL,
    CHECK (Current_Amount >= 0),
    CHECK (
        Target_Date IS NULL
        OR Target_Date >= Start_Date
    )
);

-- 6.1 SAVINGS EMI HISTORY
CREATE TABLE SAVINGS_EMI_HISTORY (
    History_ID INT AUTO_INCREMENT PRIMARY KEY,
    Goal_ID INT NOT NULL,
    Deduction_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Amount DECIMAL(15, 2) NOT NULL,
    Account_ID INT,
    Status ENUM('Success', 'Failed') DEFAULT 'Success',
    FOREIGN KEY (Goal_ID) REFERENCES SAVINGS (Goal_ID) ON DELETE CASCADE,
    FOREIGN KEY (Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE SET NULL
);

-- 7. BUDGET TABLE
CREATE TABLE BUDGET (
    Budget_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Category_ID INT NOT NULL,
    Budget_Amount DECIMAL(15, 2) NOT NULL CHECK (Budget_Amount > 0),
    Month_Year VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Category_ID) REFERENCES CATEGORY (Category_ID) ON DELETE CASCADE,
    UNIQUE (
        User_ID,
        Category_ID,
        Month_Year
    )
);

-- 8. EMI TABLE
CREATE TABLE EMI (
    EMI_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Account_ID INT NOT NULL,
    Category_ID INT,
    EMI_Title VARCHAR(100) NOT NULL,
    Lender_Name VARCHAR(100),
    Total_Loan_Amount DECIMAL(15, 2),
    Interest_Rate DECIMAL(5, 2),
    Tenure_Months INT,
    EMI_Amount DECIMAL(15, 2) NOT NULL CHECK (EMI_Amount > 0),
    EMI_Day INT CHECK (EMI_Day BETWEEN 1 AND 31),
    Start_Date DATE NOT NULL,
    End_Date DATE NOT NULL,
    Last_Deducted DATE,
    Status ENUM('Active', 'Completed') DEFAULT 'Active',
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    CHECK (End_Date >= Start_Date),
    FOREIGN KEY (Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE CASCADE,
    FOREIGN KEY (Category_ID) REFERENCES CATEGORY (Category_ID) ON DELETE CASCADE
);

-- 9. SALARY TABLE
CREATE TABLE SALARY (
    Salary_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Account_ID INT NOT NULL,
    Category_ID INT NOT NULL,
    Amount DECIMAL(15, 2) NOT NULL CHECK (Amount > 0),
    Salary_Day INT CHECK (Salary_Day BETWEEN 1 AND 31),
    Status ENUM('Active', 'Inactive') DEFAULT 'Active',
    Last_Credited DATETIME,
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Account_ID) REFERENCES ACCOUNT (Account_ID) ON DELETE CASCADE,
    FOREIGN KEY (Category_ID) REFERENCES CATEGORY (Category_ID) ON DELETE CASCADE
);

-- 9. CATEGORY_SUMMARY TABLE
CREATE TABLE CATEGORY_SUMMARY (
    Summary_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Category_ID INT NOT NULL,
    Month_Year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    Total_Amount DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Category_ID) REFERENCES CATEGORY (Category_ID) ON DELETE CASCADE,
    UNIQUE (
        User_ID,
        Category_ID,
        Month_Year
    ),
    CHECK (Total_Amount >= 0)
);

-- 10. MONTHLY_SUMMARY TABLE
CREATE TABLE MONTHLY_SUMMARY (
    Summary_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Month_Year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    Total_Income DECIMAL(15, 2) DEFAULT 0.00,
    Total_Expense DECIMAL(15, 2) DEFAULT 0.00,
    Total_EMI DECIMAL(15, 2) DEFAULT 0.00,
    Total_Savings DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE,
    UNIQUE (User_ID, Month_Year),
    CHECK (Total_Income >= 0),
    CHECK (Total_Expense >= 0),
    CHECK (Total_EMI >= 0)
);

-- 11. AUDIT_LOG TABLE
CREATE TABLE AUDIT_LOG (
    Log_ID INT AUTO_INCREMENT PRIMARY KEY,
    Table_Name VARCHAR(50),
    Action_Type ENUM('INSERT', 'UPDATE', 'DELETE'),
    Record_ID INT, -- Generic ID for deleted records or tables without specific columns
    Changed_By_User_ID INT,

-- Specific Foreign Keys for Relationships (Nullable)
Transaction_ID INT,
Budget_ID INT,
Goal_ID INT,
Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

-- Relationships
FOREIGN KEY (Changed_By_User_ID) REFERENCES USERS (User_ID) ON DELETE SET NULL,
    FOREIGN KEY (Transaction_ID) REFERENCES TRANSACTION (Transaction_ID) ON DELETE SET NULL,
    FOREIGN KEY (Budget_ID) REFERENCES BUDGET (Budget_ID) ON DELETE SET NULL,
    FOREIGN KEY (Goal_ID) REFERENCES SAVINGS (Goal_ID) ON DELETE SET NULL
);

-- ==========================================================
-- 2. STORED PROCEDURES
-- ==========================================================

DELIMITER $$

-- 1. REGISTER USER
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
    INSERT INTO USERS (Name, Email, Address, Occupation, Monthly_Income, Password, Last_Login)
    VALUES (p_Name, p_Email, p_Address, p_Occupation, p_Monthly_Income, p_Password, NOW());
    
    INSERT INTO USER_PHONES (User_ID, Phone_No, Is_Primary)
    VALUES (LAST_INSERT_ID(), p_Phone, TRUE);
END$$

-- 2. ADD TRANSACTION (Main Logic)
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
END$$

-- 3. FUND TRANSFER
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
        INSERT INTO TRANSACTION (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
        VALUES (p_User_ID, p_From_Account_ID, p_Amount, 'Expense', 'Transfer', 'Fund Transfer Out', NOW());

        -- Record as Income in To Account
        INSERT INTO TRANSACTION (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
        VALUES (p_User_ID, p_To_Account_ID, p_Amount, 'Income', 'Transfer', 'Fund Transfer In', NOW());

    COMMIT;
END$$

-- 4. SEARCH TRANSACTIONS
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
        T.Description,
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
END$$

DELIMITER;

-- ==========================================================
-- 3. TRIGGERS
-- ==========================================================

DELIMITER $$

-- 1. UPDATE BALANCE AFTER TRANSACTION
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
END$$

-- 2. UPDATE SUMMARIES AFTER TRANSACTION
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
END$$

-- 3. AUDIT LOG FOR SENSITIVE CHANGES (USERS)
CREATE TRIGGER trg_audit_user_update
AFTER UPDATE ON USERS
FOR EACH ROW
BEGIN
    IF OLD.Password != NEW.Password THEN
        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
        VALUES ('USERS', 'UPDATE', OLD.User_ID, OLD.User_ID);
    END IF;
END$$

-- 4. CHECK SAVINGS GOAL COMPLETION
CREATE TRIGGER trg_check_savings_goal
BEFORE UPDATE ON SAVINGS
FOR EACH ROW
BEGIN
    IF NEW.Current_Amount >= NEW.Target_Amount AND OLD.Status = 'Active' THEN
        SET NEW.Status = 'Achieved';
    END IF;
END$$

-- 5. AUDIT LOG FOR TRANSACTION DELETION
-- Note: Cannot link Transaction_ID here because the record is deleted.
CREATE TRIGGER trg_audit_transaction_delete
AFTER DELETE ON TRANSACTION
FOR EACH ROW
BEGIN
    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
    VALUES ('TRANSACTION', 'DELETE', OLD.Transaction_ID, OLD.User_ID);
END$$

-- 6. AUDIT LOG FOR TRANSACTION MODIFICATION
CREATE TRIGGER trg_audit_transaction_update
AFTER UPDATE ON TRANSACTION
FOR EACH ROW
BEGIN
    IF OLD.Amount != NEW.Amount THEN
        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Transaction_ID, Changed_By_User_ID)
        VALUES ('TRANSACTION', 'UPDATE', NEW.Transaction_ID, NEW.Transaction_ID, NEW.User_ID);
    END IF;
END$$

-- 7. AUDIT LOG FOR BUDGET UPDATES
CREATE TRIGGER trg_audit_budget_update
AFTER UPDATE ON BUDGET
FOR EACH ROW
BEGIN
    IF OLD.Budget_Amount != NEW.Budget_Amount THEN
        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID)
        VALUES ('BUDGET', 'UPDATE', NEW.Budget_ID, NEW.Budget_ID, NEW.User_ID);
    END IF;
END$$

-- 8. AUDIT LOG FOR SAVINGS GOAL UPDATES
CREATE TRIGGER trg_audit_savings_update
AFTER UPDATE ON SAVINGS
FOR EACH ROW
BEGIN
    IF OLD.Target_Amount != NEW.Target_Amount THEN
        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Goal_ID, Changed_By_User_ID)
        VALUES ('SAVINGS', 'UPDATE', NEW.Goal_ID, NEW.Goal_ID, NEW.User_ID);
    END IF;
END$$

DELIMITER;

-- ==========================================================
-- 4. VIEWS
-- ==========================================================

-- 1. USER TRANSACTION HISTORY
CREATE OR REPLACE VIEW vw_user_transaction_history AS
SELECT t.Transaction_ID, u.Name AS User_Name, a.Account_Name, c.Category_Name, t.Amount, t.Transaction_Type, t.Reference_Type, t.Description, t.Transaction_DateTime
FROM
    TRANSACTION t
    JOIN USERS u ON t.User_ID = u.User_ID
    JOIN ACCOUNT a ON t.Account_ID = a.Account_ID
    LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
ORDER BY t.Transaction_DateTime DESC;

-- 2. MONTHLY SPENDING BY CATEGORY
CREATE OR REPLACE VIEW vw_monthly_category_spend AS
SELECT
    User_ID,
    Category_ID,
    DATE_FORMAT(Transaction_DateTime, '%Y-%m') AS Month_Year,
    SUM(Amount) AS Total_Spent
FROM TRANSACTION
WHERE
    Transaction_Type = 'Expense'
GROUP BY
    User_ID,
    Category_ID,
    Month_Year;

-- 3. CURRENT FINANCIAL STATUS
CREATE OR REPLACE VIEW vw_account_status AS
SELECT
    User_ID,
    COUNT(Account_ID) AS Total_Accounts,
    SUM(Balance) AS Net_Worth
FROM ACCOUNT
GROUP BY
    User_ID;

-- ==========================================================
-- 5. SEED DATA (Testing)
-- ==========================================================

-- 1. USERS
INSERT INTO
    USERS (
        Name,
        Email,
        Address,
        Occupation,
        Monthly_Income,
        Password,
        role
    )
VALUES (
        'Rohan Sharma',
        'rohan@example.com',
        'Mumbai, India',
        'Employee',
        85000.00,
        'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
        'USER'
    ),
    (
        'Priya Verma',
        'priya@example.com',
        'Bangalore, India',
        'Employee',
        120000.00,
        'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
        'USER'
    ),
    (
        'Admin User',
        'admin@example.com',
        'Admin Office',
        'Administrator',
        0.00,
        'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
        'ADMIN'
    );

-- 1.1 USER_PHONES
INSERT INTO
    USER_PHONES (User_ID, Phone_No, Is_Primary)
VALUES (1, '9876543210', TRUE),
    (2, '9876500000', TRUE),
    (3, '9999999999', TRUE);

-- 2. ACCOUNTS (Rohan)
INSERT INTO
    ACCOUNT (
        User_ID,
        Account_Name,
        Account_Type,
        Balance
    )
VALUES (
        1,
        'HDFC Salary Acct',
        'Bank',
        50000.00
    ), -- Fixed Enum from 'Savings Bank' to 'Bank'
    (
        1,
        'Paytm Wallet',
        'Wallet',
        2500.00
    ),
    (
        1,
        'Cash in Hand',
        'Cash',
        5000.00
    );

-- 3. CATEGORIES (Standard)
INSERT INTO
    CATEGORY (
        User_ID,
        Category_Name,
        Category_Type
    )
VALUES (1, 'Salary', 'Income'),
    (1, 'Rent', 'Expense'),
    (1, 'Groceries', 'Expense'),
    (1, 'Dining Out', 'Expense'),
    (1, 'Transport', 'Expense'),
    (1, 'Utilities', 'Expense');

-- 4. TRANSACTIONS
-- Initial Salary
CALL sp_add_transaction (
    1,
    1,
    1,
    85000,
    'Income',
    'Salary',
    'February Salary Credited'
);

-- Paid Rent
CALL sp_add_transaction (
    1,
    1,
    2,
    15000,
    'Expense',
    'Manual',
    'Feb Rent Payment'
);

-- Grocery Shopping via Paytm
CALL sp_add_transaction (
    1,
    2,
    3,
    1200,
    'Expense',
    'Manual',
    'BigBasket Order'
);

-- 5. SAVINGS
INSERT INTO
    SAVINGS (
        User_ID,
        Goal_Title,
        Target_Amount,
        Start_Date
    )
VALUES (
        1,
        'New MacBook',
        150000,
        CURDATE()
    );

-- 6. BUDGETs
INSERT INTO
    BUDGET (
        User_ID,
        Category_ID,
        Budget_Amount,
        Month_Year
    )
VALUES (1, 3, 5000, '2024-02');