-- =============================================
-- FINTRACK - ORACLE DATABASE SCHEMA
-- Advanced DBMS Project
-- =============================================

-- 1. USERS TABLE
CREATE TABLE USERS (
    User_ID NUMBER PRIMARY KEY,
    Name VARCHAR2(100) NOT NULL,
    Email VARCHAR2(100) UNIQUE NOT NULL,
    Phone_No VARCHAR2(10) UNIQUE NOT NULL,
    Address VARCHAR2(255),
    Occupation VARCHAR2(20)
        CHECK (Occupation IN ('Student','Employee','Business')),
    Monthly_Income NUMBER(12,2)
        CHECK (Monthly_Income >= 0),
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. AUTHENTICATION TABLE
CREATE TABLE AUTHENTICATION (
    Auth_ID NUMBER PRIMARY KEY,
    User_ID NUMBER UNIQUE NOT NULL,
    Password VARCHAR2(255) NOT NULL,
    Last_Login TIMESTAMP,
    CONSTRAINT fk_auth_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- 3. ACCOUNT TABLE (Wallet / Bank / Cash / Salary)
CREATE TABLE ACCOUNT (
    Account_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Account_Name VARCHAR2(100) NOT NULL,
    Account_Type VARCHAR2(20)
        CHECK (Account_Type IN ('Salary','Bank','Cash','Wallet','Credit Card')),
    Balance NUMBER(12,2)
        CHECK (Balance >= 0),
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_account_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- 4. CATEGORY TABLE (Food, Travel, Salary, EMI)
CREATE TABLE CATEGORY (
    Category_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Category_Name VARCHAR2(50) NOT NULL,
    Category_Type VARCHAR2(10)
        CHECK (Category_Type IN ('Income','Expense')),
    Created_At DATE DEFAULT SYSDATE,
    CONSTRAINT fk_category_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- 5. TRANSACTION TABLE
CREATE TABLE TRANSACTION (
    Transaction_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Account_ID NUMBER NOT NULL,
    Category_ID NUMBER NOT NULL,
    Amount NUMBER(12,2)
        CHECK (Amount > 0),
    Transaction_Type VARCHAR2(10)
        CHECK (Transaction_Type IN ('Income','Expense')),
    Reference_Type VARCHAR2(15)
        CHECK (Reference_Type IN ('Manual','EMI','Transfer','Emergency','Salary')),
    Transaction_DateTime TIMESTAMP NOT NULL,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tx_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID),
    CONSTRAINT fk_tx_account FOREIGN KEY (Account_ID)
        REFERENCES ACCOUNT(Account_ID),
    CONSTRAINT fk_tx_category FOREIGN KEY (Category_ID)
        REFERENCES CATEGORY(Category_ID)
);

-- 6. TRANSFER TABLE
CREATE TABLE TRANSFER (
    Transfer_ID NUMBER PRIMARY KEY,
    From_Account_ID NUMBER NOT NULL,
    To_Account_ID NUMBER NOT NULL,
    Amount NUMBER(12,2)
        CHECK (Amount > 0),
    Transfer_DateTime TIMESTAMP NOT NULL,
    CHECK (From_Account_ID <> To_Account_ID)
);

-- 7. SAVINGS TABLE
CREATE TABLE SAVINGS (
    Goal_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Goal_Title VARCHAR2(100) NOT NULL,
    Target_Amount NUMBER(12,2)
        CHECK (Target_Amount > 0),
    Current_Amount NUMBER(12,2)
        CHECK (Current_Amount >= 0),
    Start_Date DATE,
    Target_Date DATE,
    Status VARCHAR2(10)
        CHECK (Status IN ('Active','Achieved')),
    CONSTRAINT fk_savings_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- 8. BUDGET TABLE
CREATE TABLE BUDGET (
    Budget_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Category_ID NUMBER NOT NULL,
    Budget_Amount NUMBER(12,2)
        CHECK (Budget_Amount > 0),
    Month_Year VARCHAR2(7)
        CHECK (REGEXP_LIKE(Month_Year,'^\d{4}-\d{2}$')),
    CONSTRAINT fk_budget_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID),
    CONSTRAINT fk_budget_category FOREIGN KEY (Category_ID)
        REFERENCES CATEGORY(Category_ID)
);

-- 9. EMI TABLE
CREATE TABLE EMI (
    EMI_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Account_ID NUMBER NOT NULL,
    Category_ID NUMBER NOT NULL,
    EMI_Amount NUMBER(12,2)
        CHECK (EMI_Amount > 0),
    EMI_Day NUMBER
        CHECK (EMI_Day BETWEEN 1 AND 31),
    Start_Date DATE,
    End_Date DATE,
    Status VARCHAR2(10)
        CHECK (Status IN ('Active','Completed')),
    CONSTRAINT fk_emi_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- 10. BANK_ACCOUNT_LINK TABLE
CREATE TABLE BANK_ACCOUNT_LINK (
    Link_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Bank_Name VARCHAR2(50) NOT NULL,
    Masked_Account_No VARCHAR2(10) NOT NULL,
    IFSC_Code VARCHAR2(11) NOT NULL,
    Verification_Status VARCHAR2(10)
        CHECK (Verification_Status IN ('Pending','Verified','Rejected')),
    Verified_On DATE,
    CONSTRAINT fk_bank_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- 11. SALARY_CREDIT TABLE
CREATE TABLE SALARY_CREDIT (
    Salary_ID NUMBER PRIMARY KEY,
    User_ID NUMBER NOT NULL,
    Account_ID NUMBER NOT NULL,
    Credit_Amount NUMBER(12,2)
        CHECK (Credit_Amount > 0),
    Credit_Month VARCHAR2(7)
        CHECK (REGEXP_LIKE(Credit_Month,'^\d{4}-\d{2}$')),
    Credit_Date DATE,
    Source VARCHAR2(20)
        CHECK (Source IN ('BankSync','ManualUpload')),
    CONSTRAINT fk_salary_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
    -- Typically linked to an Account, but here it's a log of credits.
);

-- 12. EMERGENCY_WITHDRAWAL TABLE
CREATE TABLE EMERGENCY_WITHDRAWAL (
    Emergency_ID NUMBER PRIMARY KEY,
    Goal_ID NUMBER NOT NULL,
    User_ID NUMBER NOT NULL,
    Withdraw_Amount NUMBER(12,2)
        CHECK (Withdraw_Amount > 0),
    Reason VARCHAR2(255) NOT NULL,
    Withdraw_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_emg_goal FOREIGN KEY (Goal_ID)
        REFERENCES SAVINGS(Goal_ID),
    CONSTRAINT fk_emg_user FOREIGN KEY (User_ID)
        REFERENCES USERS(User_ID)
);

-- SEQUENCES (Optional but good for Oracle 11g compatibility or general practice)
CREATE SEQUENCE seq_user_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_tx_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_acc_id START WITH 1 INCREMENT BY 1;

COMMIT;
