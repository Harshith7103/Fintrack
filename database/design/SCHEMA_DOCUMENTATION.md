# FinTrack Database Schema Documentation

## Entity Relationship Diagram
> **Note**: You can view this diagram by opening the preview of this Markdown file in VS Code (`Ctrl+Shift+V`), or by opening `FinTrack_ER_Diagram.html` in your browser.

```mermaid
erDiagram
    %% Entities
    USERS {
        int User_ID PK
        varchar Name
        varchar Email
        varchar Phone_No
        enum Occupation
        decimal Monthly_Income
    }
    ACCOUNT {
        int Account_ID PK
        int User_ID FK
        varchar Account_Name
        enum Account_Type
        decimal Balance
    }
    CATEGORY {
        int Category_ID PK
        int User_ID FK
        varchar Category_Name
        enum Category_Type
    }
    TRANSACTION {
        int Transaction_ID PK
        int User_ID FK
        int Account_ID FK
        int Category_ID FK
        decimal Amount
        enum Transaction_Type
        enum Reference_Type
    }
    TRANSFER {
        int Transfer_ID PK
        int From_Account_ID FK
        int To_Account_ID FK
        decimal Amount
    }
    SAVINGS {
        int Goal_ID PK
        int User_ID FK
        string Goal_Title
        decimal Target_Amount
        decimal Current_Amount
    }
    BUDGET {
        int Budget_ID PK
        int User_ID FK
        int Category_ID FK
        decimal Budget_Amount
        string Month_Year
    }
    EMI {
        int EMI_ID PK
        int User_ID FK
        int Account_ID FK
        int Category_ID FK
        string EMI_Title
        decimal EMI_Amount
    }
    SALARY {
        int Salary_ID PK
        int User_ID FK
        int Account_ID FK
        int Category_ID FK
        decimal Amount
        int Salary_Day
    }
    AUDIT_LOG {
        int Log_ID PK
        int Changed_By_User_ID FK
        int Transaction_ID FK
        int Budget_ID FK
        int Goal_ID FK
        string Action_Type
        datetime Timestamp
    }

    %% Relationships
    USERS ||--o{ ACCOUNT : "owns"
    USERS ||--o{ CATEGORY : "defines"
    USERS ||--o{ TRANSACTION : "makes"
    USERS ||--o{ SAVINGS : "has goals"
    USERS ||--o{ BUDGET : "sets"
    USERS ||--o{ EMI : "manages"
    USERS ||--o{ SALARY : "receives"
    USERS ||--o{ AUDIT_LOG : "modifies"
    
    ACCOUNT ||--o{ TRANSACTION : "funds"
    ACCOUNT ||--o{ TRANSFER : "sends from"
    ACCOUNT ||--o{ TRANSFER : "receives to"
    ACCOUNT ||--o{ EMI : "pays"
    ACCOUNT ||--o{ SALARY : "deposits to"

    CATEGORY ||--o{ TRANSACTION : "classifies"
    CATEGORY ||--o{ BUDGET : "constrains"
    CATEGORY ||--o{ EMI : "classifies"
    CATEGORY ||--o{ SALARY : "classifies"

    TRANSACTION ||--o| AUDIT_LOG : "logs change"
    BUDGET ||--o| AUDIT_LOG : "logs change"
    SAVINGS ||--o| AUDIT_LOG : "logs change"
```

## Table Definitions

### 1. USERS
The central entity representing the application user.
- **Primary Key**: `User_ID`
- **Relationships**: Parent to all other tables.

### 2. ACCOUNT
Represents financial containers like Bank Accounts, Wallets, or Cash.
- **Foreign Keys**: `User_ID`
- **Constraints**: Balance cannot be negative for Cash/Wallet.

### 3. TRANSACTION
The core ledger of all income and expenses.
- **Foreign Keys**: `User_ID`, `Account_ID`, `Category_ID`
- **Triggers**: Automatically updates `ACCOUNT` balance and summaries.

### 4. AUDIT_LOG
Tracks sensitive changes for security and compliance.
- **Foreign Keys**: 
  - `Changed_By_User_ID` -> `USERS`
  - `Transaction_ID` -> `TRANSACTION` (Nullable)
  - `Budget_ID` -> `BUDGET` (Nullable)
  - `Goal_ID` -> `SAVINGS` (Nullable)
- **Behavior**: Records old values on Update/Delete.
