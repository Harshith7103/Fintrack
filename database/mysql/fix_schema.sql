USE fintrack_final;

-- 1. Fix audit_log Action_Type to include LOGIN
ALTER TABLE audit_log MODIFY COLUMN Action_Type ENUM('INSERT','UPDATE','DELETE','LOGIN') DEFAULT 'INSERT';

-- 2. Add Description column to audit_log (ignore error if already exists)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'fintrack_final' AND TABLE_NAME = 'audit_log' AND COLUMN_NAME = 'Description'
);
SET @sql = IF(@col_exists = 0, 'ALTER TABLE audit_log ADD COLUMN Description TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Fix admin email to match login page
UPDATE users SET Email = 'admin123@gmail.com' WHERE role = 'ADMIN';

-- 4. Add demo user john@example.com (password: password123 → sha256)
INSERT IGNORE INTO users (Name, Email, Address, Occupation, Monthly_Income, Password, role, Account_Status)
VALUES ('John Demo', 'john@example.com', 'Mumbai, India', 'Employee', 75000.00,
        'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'USER', 'active');

-- 5. Add phones for existing users
INSERT IGNORE INTO user_phones (User_ID, Phone_No, Is_Primary) VALUES (1, '9876543210', TRUE);
INSERT IGNORE INTO user_phones (User_ID, Phone_No, Is_Primary) VALUES (2, '9876500000', TRUE);
INSERT IGNORE INTO user_phones (User_ID, Phone_No, Is_Primary) VALUES (3, '9999999999', TRUE);

-- 6. Phone + account for john
SET @john_id = (SELECT User_ID FROM users WHERE Email='john@example.com' LIMIT 1);
INSERT IGNORE INTO user_phones (User_ID, Phone_No, Is_Primary) VALUES (@john_id, '9000000001', TRUE);

-- 7. Default account for john if none exists
INSERT INTO account (User_ID, Account_Name, Account_Type, Balance)
SELECT @john_id, 'Cash Wallet', 'Cash', 75000.00
WHERE @john_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM account WHERE User_ID = @john_id);

-- 8. Default categories for john
INSERT IGNORE INTO category (User_ID, Category_Name, Category_Type)
SELECT @john_id, cat.name, cat.type FROM (
  SELECT 'Salary' AS name, 'Income' AS type UNION ALL
  SELECT 'Food', 'Expense' UNION ALL
  SELECT 'Travel', 'Expense' UNION ALL
  SELECT 'Bills', 'Expense' UNION ALL
  SELECT 'Shopping', 'Expense' UNION ALL
  SELECT 'Rent', 'Expense' UNION ALL
  SELECT 'Health', 'Expense' UNION ALL
  SELECT 'Entertainment', 'Expense'
) cat WHERE @john_id IS NOT NULL;

-- 9. Ensure SALARY table exists (some installs may be missing it)
CREATE TABLE IF NOT EXISTS salary (
  Salary_ID INT AUTO_INCREMENT PRIMARY KEY,
  User_ID INT NOT NULL,
  Account_ID INT NOT NULL,
  Category_ID INT NOT NULL,
  Amount DECIMAL(15,2) NOT NULL,
  Salary_Day INT,
  Status ENUM('Active','Inactive') DEFAULT 'Active',
  Last_Credited DATETIME,
  Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (User_ID) REFERENCES users(User_ID) ON DELETE CASCADE,
  FOREIGN KEY (Account_ID) REFERENCES account(Account_ID) ON DELETE CASCADE,
  FOREIGN KEY (Category_ID) REFERENCES category(Category_ID) ON DELETE CASCADE
);

-- 10. Ensure savings_emi_history exists
CREATE TABLE IF NOT EXISTS savings_emi_history (
  History_ID INT AUTO_INCREMENT PRIMARY KEY,
  Goal_ID INT NOT NULL,
  Deduction_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
  Amount DECIMAL(15,2) NOT NULL,
  Account_ID INT,
  Status ENUM('Success','Failed') DEFAULT 'Success',
  FOREIGN KEY (Goal_ID) REFERENCES savings(Goal_ID) ON DELETE CASCADE
);

SELECT 'All schema fixes applied!' AS result;
