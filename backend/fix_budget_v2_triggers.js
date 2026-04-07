const db = require('./db');

async function fixBudgetV2Triggers() {
    try {
        console.log("Fixing triggers for BUDGET_V2 (Removing invalid FK reference)...");
        const conn = await db.getConnection();

        // Drop old triggers
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_budget_v2_insert");
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_budget_v2_update");
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_budget_v2_delete");

        // 1. INSERT Trigger
        // Don't populate 'Budget_ID' column in Audit Log because it references the old 'BUDGET' table
        console.log("Creating INSERT trigger...");
        await conn.query(`
            CREATE TRIGGER trg_audit_budget_v2_insert AFTER INSERT ON BUDGET_V2 FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('BUDGET_V2', 'INSERT', NEW.Budget_ID, NEW.User_ID, CONCAT('Created Budget: ', NEW.Budget_Name, ' (₹', NEW.Total_Budget_Amount, ')'), NOW());
            END
        `);

        // 2. UPDATE Trigger (Handles Soft Delete)
        console.log("Creating UPDATE trigger...");
        await conn.query(`
            CREATE TRIGGER trg_audit_budget_v2_update AFTER UPDATE ON BUDGET_V2 FOR EACH ROW
            BEGIN
                -- soft delete check
                IF NEW.Status = 'Deleted' AND OLD.Status != 'Deleted' THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('BUDGET_V2', 'DELETE', NEW.Budget_ID, NEW.User_ID, CONCAT('Deleted Budget: ', NEW.Budget_Name), NOW());
                
                -- standard update
                ELSEIF OLD.Total_Budget_Amount != NEW.Total_Budget_Amount THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('BUDGET_V2', 'UPDATE', NEW.Budget_ID, NEW.User_ID, CONCAT('Updated Budget Amount: ', OLD.Total_Budget_Amount, ' -> ', NEW.Total_Budget_Amount), NOW());
                
                ELSEIF OLD.Status != NEW.Status THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES ('BUDGET_V2', 'UPDATE', NEW.Budget_ID, NEW.User_ID, CONCAT('Budget Status: ', OLD.Status, ' -> ', NEW.Status), NOW());
                END IF;
            END
        `);

        // 3. DELETE Trigger (Hard Delete Fallback)
        console.log("Creating DELETE trigger...");
        await conn.query(`
            CREATE TRIGGER trg_audit_budget_v2_delete AFTER DELETE ON BUDGET_V2 FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('BUDGET_V2', 'DELETE', OLD.Budget_ID, OLD.User_ID, CONCAT('Permanently Deleted Budget: ', OLD.Budget_Name), NOW());
            END
        `);

        conn.release();
        console.log("BUDGET_V2 triggers fixed successfully!");
        process.exit(0);

    } catch (err) {
        console.error("Error fixing triggers:", err);
        process.exit(1);
    }
}

fixBudgetV2Triggers();
