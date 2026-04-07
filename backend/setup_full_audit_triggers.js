const db = require('./db');

async function setupFullAuditTriggers() {
    try {
        console.log("Setting up COMPREHENSIVE Audit Triggers for ALL tables...");
        const conn = await db.getConnection();

        const tables = [
            { name: 'TRANSACTION', id: 'Transaction_ID', user: 'User_ID', cols: ['Amount', 'Description', 'Category_ID'] },
            { name: 'SAVINGS', id: 'Goal_ID', user: 'User_ID', cols: ['Target_Amount', 'Current_Amount', 'Goal_Title'] },
            { name: 'BUDGET', id: 'Budget_ID', user: 'User_ID', cols: ['Budget_Amount'] },
            { name: 'EMI', id: 'EMI_ID', user: 'User_ID', cols: ['EMI_Amount', 'Status'] },
            { name: 'SALARY', id: 'Salary_ID', user: 'User_ID', cols: ['Amount', 'Status'] },
            { name: 'ACCOUNT', id: 'Account_ID', user: 'User_ID', cols: ['Account_Name', 'Balance'] },
            { name: 'CATEGORY', id: 'Category_ID', user: 'User_ID', cols: ['Category_Name'] },
            { name: 'TRANSACTION', id: 'Transaction_ID', user: 'User_ID', cols: ['Amount', 'Description', 'Category_ID'] },
            { name: 'SAVINGS', id: 'Goal_ID', user: 'User_ID', cols: ['Target_Amount', 'Current_Amount', 'Goal_Title'] },
            { name: 'BUDGET', id: 'Budget_ID', user: 'User_ID', cols: ['Budget_Amount'] },
            { name: 'EMI', id: 'EMI_ID', user: 'User_ID', cols: ['EMI_Amount', 'Status'] },
            { name: 'SALARY', id: 'Salary_ID', user: 'User_ID', cols: ['Amount', 'Status'] },
            { name: 'ACCOUNT', id: 'Account_ID', user: 'User_ID', cols: ['Account_Name', 'Balance'] },
            { name: 'CATEGORY', id: 'Category_ID', user: 'User_ID', cols: ['Category_Name'] },
            { name: 'USERS', id: 'User_ID', user: 'User_ID', cols: ['Name', 'Address', 'Occupation', 'Monthly_Income'] },
            { name: 'USER_PHONES', id: 'Phone_ID', user: 'User_ID', cols: ['Phone_No', 'Is_Primary'] }
        ];

        for (const t of tables) {
            console.log(`Processing triggers for ${t.name}...`);

            // 1. DROP Existing (Clean Slate)
            await conn.query(`DROP TRIGGER IF EXISTS trg_audit_${t.name}_insert`);
            await conn.query(`DROP TRIGGER IF EXISTS trg_audit_${t.name}_update`);
            await conn.query(`DROP TRIGGER IF EXISTS trg_audit_${t.name}_delete`);

            // 2. INSERT
            await conn.query(`
                CREATE TRIGGER trg_audit_${t.name}_insert AFTER INSERT ON ${t.name} FOR EACH ROW
                BEGIN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('${t.name}', 'INSERT', NEW.${t.id}, NEW.${t.user}, CONCAT('Created new record in ${t.name}'), NOW());
                END
            `);

            // 3. UPDATE (Dynamic + Special Cases)
            let updateLogic = "";

            // Generic Columns
            for (const col of t.cols) {
                updateLogic += `
                    IF (OLD.${col} != NEW.${col} OR (OLD.${col} IS NULL AND NEW.${col} IS NOT NULL) OR (OLD.${col} IS NOT NULL AND NEW.${col} IS NULL)) THEN
                        INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                        VALUES ('${t.name}', 'UPDATE', NEW.${t.id}, NEW.${t.user}, CONCAT('Updated ${col}: ', COALESCE(OLD.${col}, 'NULL'), ' -> ', COALESCE(NEW.${col}, 'NULL')), NOW());
                    END IF;
                `;
            }

            // Special Case: USERS table (Login & Password)
            if (t.name === 'USERS') {
                updateLogic += `
                    -- Check Login Timestamp
                    IF OLD.Last_Login != NEW.Last_Login THEN
                         INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                         VALUES ('USERS', 'LOGIN', NEW.User_ID, NEW.User_ID, CONCAT('User Login: ', NEW.Name), NOW());
                    END IF;

                    -- Check Password Change
                    IF OLD.Password != NEW.Password THEN
                         INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                         VALUES ('USERS', 'UPDATE', NEW.User_ID, NEW.User_ID, 'Password Changed', NOW());
                    END IF;
                `;
            }

            if (updateLogic) {
                await conn.query(`
                    CREATE TRIGGER trg_audit_${t.name}_update AFTER UPDATE ON ${t.name} FOR EACH ROW
                    BEGIN
                        ${updateLogic}
                    END
                `);
            }

            // 4. DELETE
            await conn.query(`
                CREATE TRIGGER trg_audit_${t.name}_delete AFTER DELETE ON ${t.name} FOR EACH ROW
                BEGIN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('${t.name}', 'DELETE', OLD.${t.id}, OLD.${t.user}, CONCAT('Deleted record from ${t.name}'), NOW());
                END
            `);
        }

        conn.release();
        console.log("✅ All Audit Log triggers updated successfully! (Including Login & Password tracking)");
        process.exit(0);

    } catch (err) {
        console.error("❌ Error setting up triggers:", err);
        process.exit(1);
    }
}

setupFullAuditTriggers();
