const db = require('./db');

async function applyAuditSchema() {
    console.log('Migrating Audit Log Schema...');

    try {
        // 1. Alter Table
        // Use separate ALTER statements to be safe
        const alterQueries = [
            `ALTER TABLE AUDIT_LOG ADD COLUMN IF NOT EXISTS Transaction_ID INT`,
            `ALTER TABLE AUDIT_LOG ADD COLUMN IF NOT EXISTS Budget_ID INT`,
            `ALTER TABLE AUDIT_LOG ADD COLUMN IF NOT EXISTS Goal_ID INT`,

            // Add Constraints (Check if exists first usually hard in raw SQL without procedure, but in MySQL we can try-catch or ignore)
            // We'll wrap in try-catch in JS or assume they don't exist yet
            `ALTER TABLE AUDIT_LOG ADD CONSTRAINT fk_audit_user FOREIGN KEY (Changed_By_User_ID) REFERENCES USERS(User_ID) ON DELETE SET NULL`,
            `ALTER TABLE AUDIT_LOG ADD CONSTRAINT fk_audit_trans FOREIGN KEY (Transaction_ID) REFERENCES TRANSACTION(Transaction_ID) ON DELETE SET NULL`,
            `ALTER TABLE AUDIT_LOG ADD CONSTRAINT fk_audit_budget FOREIGN KEY (Budget_ID) REFERENCES BUDGET(Budget_ID) ON DELETE SET NULL`,
            `ALTER TABLE AUDIT_LOG ADD CONSTRAINT fk_audit_savings FOREIGN KEY (Goal_ID) REFERENCES SAVINGS(Goal_ID) ON DELETE SET NULL`
        ];

        for (const q of alterQueries) {
            try {
                await db.query(q);
                console.log(`Executed: ${q.substring(0, 50)}...`);
            } catch (err) {
                // Ignore "duplicate key" or "duplicate column" errors
                if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEY' || err.code === 'ER_FK_DUP_NAME') {
                    console.log(`Skipping (already exists): ${q.substring(0, 50)}...`);
                } else {
                    console.error(`Error executing ${q}:`, err.message);
                }
            }
        }

        // 2. Refresh Triggers
        const triggers = [
            `DROP TRIGGER IF EXISTS trg_audit_transaction_update`,
            `
            CREATE TRIGGER trg_audit_transaction_update
            AFTER UPDATE ON TRANSACTION
            FOR EACH ROW
            BEGIN
                IF OLD.Amount != NEW.Amount THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Transaction_ID, Changed_By_User_ID)
                    VALUES ('TRANSACTION', 'UPDATE', NEW.Transaction_ID, NEW.Transaction_ID, NEW.User_ID);
                END IF;
            END
            `,
            `DROP TRIGGER IF EXISTS trg_audit_budget_update`,
            `
            CREATE TRIGGER trg_audit_budget_update
            AFTER UPDATE ON BUDGET
            FOR EACH ROW
            BEGIN
                IF OLD.Budget_Amount != NEW.Budget_Amount THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID)
                    VALUES ('BUDGET', 'UPDATE', NEW.Budget_ID, NEW.Budget_ID, NEW.User_ID);
                END IF;
            END
            `,
            `DROP TRIGGER IF EXISTS trg_audit_savings_update`,
            `
            CREATE TRIGGER trg_audit_savings_update
            AFTER UPDATE ON SAVINGS
            FOR EACH ROW
            BEGIN
                IF OLD.Target_Amount != NEW.Target_Amount THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Goal_ID, Changed_By_User_ID)
                    VALUES ('SAVINGS', 'UPDATE', NEW.Goal_ID, NEW.Goal_ID, NEW.User_ID);
                END IF;
            END
            `,
            `DROP TRIGGER IF EXISTS trg_audit_transaction_delete`,
            `
            CREATE TRIGGER trg_audit_transaction_delete
            AFTER DELETE ON TRANSACTION
            FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID)
                VALUES ('TRANSACTION', 'DELETE', OLD.Transaction_ID, OLD.User_ID);
            END
            `
        ];

        for (const sql of triggers) {
            try {
                await db.query(sql);
                console.log('Updated trigger.');
            } catch (err) {
                console.error('Error updating trigger:', err.message);
            }
        }

        console.log('✅ Audit Log schema and relationships updated successfully.');

    } catch (error) {
        console.error('❌ Critical Error:', error);
    } finally {
        process.exit();
    }
}

applyAuditSchema();
