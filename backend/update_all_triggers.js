const db = require('./db');

async function updateAllTableTriggers() {
    try {
        console.log("Updating triggers for ALL key tables (TRANSACTION, ACCOUNT, BUDGET, SAVINGS, EMI, SALARY)...");
        const conn = await db.getConnection();

        // Helper to drop old triggers
        const tables = ['TRANSACTION', 'ACCOUNT', 'BUDGET', 'SAVINGS', 'EMI', 'SALARY'];
        for (const tbl of tables) {
            await conn.query(`DROP TRIGGER IF EXISTS trg_audit_${tbl.toLowerCase()}_insert`);
            await conn.query(`DROP TRIGGER IF EXISTS trg_audit_${tbl.toLowerCase()}_update`);
            await conn.query(`DROP TRIGGER IF EXISTS trg_audit_${tbl.toLowerCase()}_delete`);
        }

        // --- 1. ACCOUNT ---
        console.log("Creating triggers for ACCOUNT...");
        await conn.query(`
            CREATE TRIGGER trg_audit_account_insert AFTER INSERT ON ACCOUNT FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('ACCOUNT', 'INSERT', NEW.Account_ID, NEW.User_ID, CONCAT('Created Account: ', NEW.Account_Name), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_account_update AFTER UPDATE ON ACCOUNT FOR EACH ROW
            BEGIN
                IF OLD.Balance != NEW.Balance THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('ACCOUNT', 'UPDATE', NEW.Account_ID, NEW.User_ID, CONCAT('Account Balance Updated: ', OLD.Balance, ' -> ', NEW.Balance), NOW());
                END IF;
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_account_delete AFTER DELETE ON ACCOUNT FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('ACCOUNT', 'DELETE', OLD.Account_ID, OLD.User_ID, CONCAT('Deleted Account: ', OLD.Account_Name), NOW());
            END
        `);

        // --- 2. BUDGET ---
        console.log("Creating triggers for BUDGET...");
        await conn.query(`
            CREATE TRIGGER trg_audit_budget_insert AFTER INSERT ON BUDGET FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('BUDGET', 'INSERT', NEW.Budget_ID, NEW.Budget_ID, NEW.User_ID, CONCAT('Set Budget: ', NEW.Budget_Amount, ' for ', NEW.Month_Year), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_budget_update AFTER UPDATE ON BUDGET FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('BUDGET', 'UPDATE', NEW.Budget_ID, NEW.Budget_ID, NEW.User_ID, CONCAT('Updated Budget: ', OLD.Budget_Amount, ' -> ', NEW.Budget_Amount), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_budget_delete AFTER DELETE ON BUDGET FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('BUDGET', 'DELETE', OLD.Budget_ID, OLD.User_ID, CONCAT('Deleted Budget: ', OLD.Budget_Amount, ' (', OLD.Month_Year, ')'), NOW());
            END
        `);

        // --- 3. SAVINGS ---
        console.log("Creating triggers for SAVINGS...");
        await conn.query(`
            CREATE TRIGGER trg_audit_savings_insert AFTER INSERT ON SAVINGS FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Goal_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('SAVINGS', 'INSERT', NEW.Goal_ID, NEW.Goal_ID, NEW.User_ID, CONCAT('New Goal: ', NEW.Goal_Title, ' (Target: ', NEW.Target_Amount, ')'), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_savings_update AFTER UPDATE ON SAVINGS FOR EACH ROW
            BEGIN
                IF OLD.Current_Amount != NEW.Current_Amount THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Goal_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('SAVINGS', 'UPDATE', NEW.Goal_ID, NEW.Goal_ID, NEW.User_ID, CONCAT('Goal Progress: ', OLD.Current_Amount, ' -> ', NEW.Current_Amount), NOW());
                ELSEIF OLD.Target_Amount != NEW.Target_Amount THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Goal_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('SAVINGS', 'UPDATE', NEW.Goal_ID, NEW.Goal_ID, NEW.User_ID, CONCAT('Goal Target Changed: ', OLD.Target_Amount, ' -> ', NEW.Target_Amount), NOW());
                END IF;
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_savings_delete AFTER DELETE ON SAVINGS FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('SAVINGS', 'DELETE', OLD.Goal_ID, OLD.User_ID, CONCAT('Deleted Goal: ', OLD.Goal_Title), NOW());
            END
        `);

        // --- 4. EMI ---
        console.log("Creating triggers for EMI...");
        await conn.query(`
            CREATE TRIGGER trg_audit_emi_insert AFTER INSERT ON EMI FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('EMI', 'INSERT', NEW.EMI_ID, NEW.User_ID, CONCAT('New EMI: ', NEW.EMI_Title, ' (Amount: ', NEW.EMI_Amount, ')'), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_emi_update AFTER UPDATE ON EMI FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('EMI', 'UPDATE', NEW.EMI_ID, NEW.User_ID, CONCAT('Updated EMI: ', NEW.EMI_Title), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_emi_delete AFTER DELETE ON EMI FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('EMI', 'DELETE', OLD.EMI_ID, OLD.User_ID, CONCAT('Deleted EMI: ', OLD.EMI_Title), NOW());
            END
        `);

        // --- 5. SALARY ---
        console.log("Creating triggers for SALARY...");
        await conn.query(`
            CREATE TRIGGER trg_audit_salary_insert AFTER INSERT ON SALARY FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('SALARY', 'INSERT', NEW.Salary_ID, NEW.User_ID, CONCAT('New Salary Config: ', NEW.Amount, ' on Day ', NEW.Salary_Day), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_salary_update AFTER UPDATE ON SALARY FOR EACH ROW
            BEGIN
                 INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('SALARY', 'UPDATE', NEW.Salary_ID, NEW.User_ID, CONCAT('Updated Salary Config'), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_salary_delete AFTER DELETE ON SALARY FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('SALARY', 'DELETE', OLD.Salary_ID, OLD.User_ID, CONCAT('Deleted Salary Config'), NOW());
            END
        `);

        // Re-apply TRANSACTION triggers (just in case they were dropped by accident or needed refresh)
        console.log("Refreshing TRANSACTION triggers...");
        await conn.query(`
            CREATE TRIGGER trg_audit_transaction_insert AFTER INSERT ON \`TRANSACTION\` FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Transaction_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('TRANSACTION', 'INSERT', NEW.Transaction_ID, NEW.Transaction_ID, NEW.User_ID, CONCAT(NEW.Transaction_Type, ': ', NEW.Amount, ' (', IFNULL(NEW.Description, 'No Desc'), ')'), NOW());
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_transaction_update AFTER UPDATE ON \`TRANSACTION\` FOR EACH ROW
            BEGIN
                IF OLD.Amount != NEW.Amount OR OLD.Description != NEW.Description THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Transaction_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('TRANSACTION', 'UPDATE', NEW.Transaction_ID, NEW.Transaction_ID, NEW.User_ID, CONCAT('Updated Txn ', NEW.Transaction_ID, '. Old: ', OLD.Amount, ', New: ', NEW.Amount), NOW());
                END IF;
            END
        `);
        await conn.query(`
            CREATE TRIGGER trg_audit_transaction_delete AFTER DELETE ON \`TRANSACTION\` FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('TRANSACTION', 'DELETE', OLD.Transaction_ID, OLD.User_ID, CONCAT('Deleted Txn: ', OLD.Transaction_Type, ' of ', OLD.Amount), NOW());
            END
        `);

        conn.release();
        console.log("All tables are now fully audited!");
        process.exit(0);

    } catch (err) {
        console.error("Error updating all triggers:", err);
        process.exit(1);
    }
}

updateAllTableTriggers();
