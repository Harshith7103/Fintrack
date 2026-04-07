const db = require('./db');

const addMoreProcedures = async () => {
    try {
        console.log('Adding more PL/SQL Procedures...');

        // 1. Procedure: sp_create_savings_goal
        await db.query(`DROP PROCEDURE IF EXISTS sp_create_savings_goal`);
        await db.query(`
            CREATE PROCEDURE sp_create_savings_goal(
                IN p_User_ID INT,
                IN p_Goal_Title VARCHAR(100),
                IN p_Target_Amount DECIMAL(15,2),
                IN p_Target_Date DATE
            )
            BEGIN
                -- Check if a goal with the same title is already active
                IF EXISTS (SELECT 1 FROM SAVINGS WHERE User_ID = p_User_ID AND Goal_Title = p_Goal_Title AND Status = 'Active') THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An active savings goal with this title already exists';
                END IF;

                INSERT INTO SAVINGS (User_ID, Goal_Title, Target_Amount, Start_Date, Target_Date, Status)
                VALUES (p_User_ID, p_Goal_Title, p_Target_Amount, CURDATE(), p_Target_Date, 'Active');
            END
        `);
        console.log('✅ sp_create_savings_goal procedure created.');

        // 2. Procedure: sp_add_to_savings_goal
        await db.query(`DROP PROCEDURE IF EXISTS sp_add_to_savings_goal`);
        await db.query(`
            CREATE PROCEDURE sp_add_to_savings_goal(
                IN p_Goal_ID INT,
                IN p_Amount DECIMAL(15,2)
            )
            BEGIN
                DECLARE v_Current_Amount DECIMAL(15,2);
                DECLARE v_Target_Amount DECIMAL(15,2);
                DECLARE v_Status ENUM('Active', 'Achieved');

                -- Retrieve goal data
                SELECT Current_Amount, Target_Amount, Status 
                INTO v_Current_Amount, v_Target_Amount, v_Status
                FROM SAVINGS WHERE Goal_ID = p_Goal_ID FOR UPDATE;

                IF v_Status = 'Achieved' THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This savings goal is already achieved';
                END IF;

                -- Update the current amount
                SET v_Current_Amount = v_Current_Amount + p_Amount;

                -- Determine new status
                IF v_Current_Amount >= v_Target_Amount THEN
                    SET v_Status = 'Achieved';
                END IF;

                UPDATE SAVINGS 
                SET Current_Amount = v_Current_Amount, Status = v_Status
                WHERE Goal_ID = p_Goal_ID;
            END
        `);
        console.log('✅ sp_add_to_savings_goal procedure created.');

        // 3. Procedure: sp_create_or_update_budget
        await db.query(`DROP PROCEDURE IF EXISTS sp_create_or_update_budget`);
        await db.query(`
            CREATE PROCEDURE sp_create_or_update_budget(
                IN p_User_ID INT,
                IN p_Category_ID INT,
                IN p_Budget_Amount DECIMAL(15,2),
                IN p_Month_Year VARCHAR(7)
            )
            BEGIN
                IF p_Budget_Amount <= 0 THEN
                   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Budget amount must be strictly positive';
                END IF;

                INSERT INTO BUDGET (User_ID, Category_ID, Budget_Amount, Month_Year)
                VALUES (p_User_ID, p_Category_ID, p_Budget_Amount, p_Month_Year)
                ON DUPLICATE KEY UPDATE Budget_Amount = p_Budget_Amount;
            END
        `);
        console.log('✅ sp_create_or_update_budget procedure created.');

        // 4. Procedure: sp_get_budget_status
        // Returns the budgets vs current spent amounts for a user in a specific month
        await db.query(`DROP PROCEDURE IF EXISTS sp_get_budget_status`);
        await db.query(`
            CREATE PROCEDURE sp_get_budget_status(
                IN p_User_ID INT,
                IN p_Month_Year VARCHAR(7)
            )
            BEGIN
                SELECT 
                    b.Budget_ID,
                    c.Category_Name, 
                    b.Budget_Amount, 
                    COALESCE(cs.Total_Amount, 0) AS Spent_Amount,
                    (b.Budget_Amount - COALESCE(cs.Total_Amount, 0)) AS Remaining_Amount,
                    CASE 
                        WHEN COALESCE(cs.Total_Amount, 0) > b.Budget_Amount THEN 'Exceeded'
                        WHEN COALESCE(cs.Total_Amount, 0) = b.Budget_Amount THEN 'Reached'
                        ELSE 'Safe'
                    END as Status
                FROM BUDGET b
                JOIN CATEGORY c ON b.Category_ID = c.Category_ID
                LEFT JOIN CATEGORY_SUMMARY cs ON cs.User_ID = b.User_ID 
                     AND cs.Category_ID = b.Category_ID 
                     AND cs.Month_Year = b.Month_Year
                WHERE b.User_ID = p_User_ID AND b.Month_Year = p_Month_Year;
            END
        `);
        console.log('✅ sp_get_budget_status procedure created.');

        // 5. Procedure: sp_generate_monthly_report
        // Aggregates total transactions grouped by category for a specific month
        await db.query(`DROP PROCEDURE IF EXISTS sp_generate_monthly_report`);
        await db.query(`
            CREATE PROCEDURE sp_generate_monthly_report(
                IN p_User_ID INT,
                IN p_Month_Year VARCHAR(7)
            )
            BEGIN
                SELECT 
                    c.Category_Name,
                    c.Category_Type,
                    COUNT(t.Transaction_ID) AS Total_Transactions,
                    SUM(t.Amount) AS Total_Spent
                FROM \`TRANSACTION\` t
                JOIN CATEGORY c ON t.Category_ID = c.Category_ID
                WHERE t.User_ID = p_User_ID AND DATE_FORMAT(t.Transaction_DateTime, '%Y-%m') = p_Month_Year
                GROUP BY c.Category_Name, c.Category_Type
                ORDER BY c.Category_Type, SUM(t.Amount) DESC;
            END
        `);
        console.log('✅ sp_generate_monthly_report procedure created.');

        console.log('🎉 5 New Pl/SQL Procedures Added Successfully!');
    } catch (err) {
        console.error('Failed to add PL/SQL procedures:', err);
    } finally {
        process.exit();
    }
};

addMoreProcedures();
