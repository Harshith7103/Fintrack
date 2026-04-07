USE fintrack_final;

-- BUDGET_V2 (event-based budgets used by BudgetManager page)
CREATE TABLE IF NOT EXISTS BUDGET_V2 (
    Budget_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Budget_Name VARCHAR(100) NOT NULL,
    Total_Budget_Amount DECIMAL(15,2) NOT NULL,
    Remaining_Budget_Amount DECIMAL(15,2) NOT NULL,
    Source_Account_ID INT,
    Status ENUM('Active','Completed','Deleted') DEFAULT 'Active',
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES users(User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Source_Account_ID) REFERENCES account(Account_ID) ON DELETE SET NULL
);

-- BUDGET_V2_CATEGORIES (line items inside an event budget)
CREATE TABLE IF NOT EXISTS BUDGET_V2_CATEGORIES (
    Category_ID INT AUTO_INCREMENT PRIMARY KEY,
    Budget_ID INT NOT NULL,
    Category_Name VARCHAR(100) NOT NULL,
    Allocated_Amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    Spent_Amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (Budget_ID) REFERENCES BUDGET_V2(Budget_ID) ON DELETE CASCADE
);

-- EVENTS table
CREATE TABLE IF NOT EXISTS EVENTS (
    Event_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Description TEXT,
    Total_Budget DECIMAL(15,2) NOT NULL,
    Remaining_Budget DECIMAL(15,2) NOT NULL,
    Status ENUM('Active','Completed','Cancelled') DEFAULT 'Active',
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES users(User_ID) ON DELETE CASCADE
);

-- EVENT_CATEGORIES table
CREATE TABLE IF NOT EXISTS EVENT_CATEGORIES (
    Category_ID INT AUTO_INCREMENT PRIMARY KEY,
    Event_ID INT NOT NULL,
    Category_Name VARCHAR(255) NOT NULL,
    Allocated_Amount DECIMAL(15,2) NOT NULL,
    Spent_Amount DECIMAL(15,2) DEFAULT 0.00,
    FOREIGN KEY (Event_ID) REFERENCES EVENTS(Event_ID) ON DELETE CASCADE
);

SELECT 'Missing tables created!' AS result;
