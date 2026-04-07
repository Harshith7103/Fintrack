USE fintrack_final;

-- BUDGET_V2: add Initial_Budget_Amount column if missing
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='fintrack_final' AND TABLE_NAME='BUDGET_V2' AND COLUMN_NAME='Initial_Budget_Amount');
SET @s = IF(@col=0, 'ALTER TABLE BUDGET_V2 ADD COLUMN Initial_Budget_Amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER Budget_Name', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- BUDGET_EVENTS (line items / categories inside a BUDGET_V2)
CREATE TABLE IF NOT EXISTS BUDGET_EVENTS (
    Event_ID INT AUTO_INCREMENT PRIMARY KEY,
    Budget_ID INT NOT NULL,
    Event_Name VARCHAR(100) NOT NULL,
    Allocated_Amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    Remaining_Event_Amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Budget_ID) REFERENCES BUDGET_V2(Budget_ID) ON DELETE CASCADE
);

-- BUDGET_TRANSACTION (audit trail for every budget operation)
CREATE TABLE IF NOT EXISTS BUDGET_TRANSACTION (
    BT_ID INT AUTO_INCREMENT PRIMARY KEY,
    Budget_ID INT NOT NULL,
    Event_ID INT,
    Transaction_Type ENUM('CREATE','ALLOCATE','SPEND','REALLOCATE','INCREASE','DELETE_REFUND') NOT NULL,
    Amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    Previous_Budget_Balance DECIMAL(15,2) DEFAULT 0,
    New_Budget_Balance DECIMAL(15,2) DEFAULT 0,
    Previous_Event_Balance DECIMAL(15,2) DEFAULT 0,
    New_Event_Balance DECIMAL(15,2) DEFAULT 0,
    Description VARCHAR(255),
    Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Budget_ID) REFERENCES BUDGET_V2(Budget_ID) ON DELETE CASCADE,
    FOREIGN KEY (Event_ID) REFERENCES BUDGET_EVENTS(Event_ID) ON DELETE SET NULL
);

-- sp_create_or_update_budget (called by budget.js POST /)
DROP PROCEDURE IF EXISTS sp_create_or_update_budget;
DELIMITER //
CREATE PROCEDURE sp_create_or_update_budget(
    IN p_User_ID INT,
    IN p_Category_ID INT,
    IN p_Budget_Amount DECIMAL(15,2),
    IN p_Month_Year VARCHAR(7)
)
BEGIN
    INSERT INTO BUDGET (User_ID, Category_ID, Budget_Amount, Month_Year)
    VALUES (p_User_ID, p_Category_ID, p_Budget_Amount, p_Month_Year)
    ON DUPLICATE KEY UPDATE Budget_Amount = p_Budget_Amount;
END //
DELIMITER ;

SELECT 'Budget tables and procedures created!' AS result;
