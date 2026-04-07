USE fintrack_final;

-- 1. ADD MISSING EVENTS TABLES
CREATE TABLE IF NOT EXISTS EVENTS (
    Event_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Description TEXT,
    Total_Budget DECIMAL(15, 2) NOT NULL,
    Remaining_Budget DECIMAL(15, 2) NOT NULL,
    Status ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active',
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS EVENT_CATEGORIES (
    Category_ID INT AUTO_INCREMENT PRIMARY KEY,
    Event_ID INT NOT NULL,
    Category_Name VARCHAR(255) NOT NULL,
    Allocated_Amount DECIMAL(15, 2) NOT NULL,
    Spent_Amount DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY (Event_ID) REFERENCES EVENTS (Event_ID) ON DELETE CASCADE
);

-- 2. ENSURE ALL COLUMNS IN SAVINGS
ALTER TABLE SAVINGS ADD COLUMN IF NOT EXISTS EMI_Enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE SAVINGS ADD COLUMN IF NOT EXISTS EMI_Amount DECIMAL(15, 2);
ALTER TABLE SAVINGS ADD COLUMN IF NOT EXISTS Account_ID INT;
ALTER TABLE SAVINGS ADD COLUMN IF NOT EXISTS EMI_Date INT;
ALTER TABLE SAVINGS ADD COLUMN IF NOT EXISTS Last_EMI_Deducted DATE;

-- 3. UPDATED PROCEDURES (Final Consolidated)
DELIMITER //

DROP PROCEDURE IF EXISTS sp_add_to_savings_goal //
CREATE PROCEDURE sp_add_to_savings_goal(IN p_Goal_ID INT, IN p_Amount DECIMAL(15,2), IN p_Account_ID INT)
BEGIN
    DECLARE v_User_ID INT;
    SELECT User_ID INTO v_User_ID FROM SAVINGS WHERE Goal_ID = p_Goal_ID;
    CALL sp_add_transaction(v_User_ID, p_Account_ID, NULL, p_Amount, 'Expense', 'Manual', 'Goal Contribution');
    UPDATE SAVINGS SET Current_Amount = Current_Amount + p_Amount WHERE Goal_ID = p_Goal_ID;
    INSERT INTO SAVINGS_EMI_HISTORY (Goal_ID, Amount, Account_ID) VALUES (p_Goal_ID, p_Amount, p_Account_ID);
END //

DROP PROCEDURE IF EXISTS sp_get_budget_status //
CREATE PROCEDURE sp_get_budget_status(IN p_UID INT, IN p_MY VARCHAR(7))
BEGIN
    SELECT c.Category_Name, b.Budget_Amount, COALESCE(SUM(t.Amount), 0) as Actual_Spent
    FROM BUDGET b JOIN CATEGORY c ON b.Category_ID = c.Category_ID
    LEFT JOIN TRANSACTION t ON b.User_ID = t.User_ID AND b.Category_ID = t.Category_ID AND DATE_FORMAT(t.Transaction_DateTime, '%Y-%m') = p_MY AND t.Transaction_Type = 'Expense'
    WHERE b.User_ID = p_UID AND b.Month_Year = p_MY GROUP BY b.Budget_ID;
END //

DELIMITER ;
