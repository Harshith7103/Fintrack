const db = require('./db');

async function applyTriggers() {
    console.log('Applying Audit Log Triggers...');

    const triggers = [
        `
        DROP TRIGGER IF EXISTS trg_audit_transaction_delete;
        `,
        `
        CREATE TRIGGER trg_audit_transaction_delete
        AFTER DELETE ON TRANSACTION
        FOR EACH ROW
        BEGIN
            INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
            VALUES ('TRANSACTION', 'DELETE', OLD.Transaction_ID, OLD.User_ID);
        END
        `,
        `
        DROP TRIGGER IF EXISTS trg_audit_transaction_update;
        `,
        `
        CREATE TRIGGER trg_audit_transaction_update
        AFTER UPDATE ON TRANSACTION
        FOR EACH ROW
        BEGIN
            IF OLD.Amount != NEW.Amount THEN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
                VALUES ('TRANSACTION', 'UPDATE', NEW.Transaction_ID, NEW.User_ID);
            END IF;
        END
        `,
        `
        DROP TRIGGER IF EXISTS trg_audit_budget_update;
        `,
        `
        CREATE TRIGGER trg_audit_budget_update
        AFTER UPDATE ON BUDGET
        FOR EACH ROW
        BEGIN
            IF OLD.Budget_Amount != NEW.Budget_Amount THEN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
                VALUES ('BUDGET', 'UPDATE', NEW.Budget_ID, NEW.User_ID);
            END IF;
        END
        `,
        `
        DROP TRIGGER IF EXISTS trg_audit_savings_update;
        `,
        `
        CREATE TRIGGER trg_audit_savings_update
        AFTER UPDATE ON SAVINGS
        FOR EACH ROW
        BEGIN
            IF OLD.Target_Amount != NEW.Target_Amount THEN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
                VALUES ('SAVINGS', 'UPDATE', NEW.Goal_ID, NEW.User_ID);
            END IF;
        END
        `
    ];

    try {
        for (const sql of triggers) {
            await db.query(sql);
            console.log('Executed trigger SQL successfully.');
        }
        console.log('✅ All Audit Log triggers applied successfully automatically.');
    } catch (error) {
        console.error('❌ Error applying triggers:', error);
    } finally {
        process.exit();
    }
}

applyTriggers();
