const db = require('./db');

async function updateAuditTriggers() {
    try {
        console.log("Updating Audit Triggers to include Descriptions and Amounts...");
        const conn = await db.getConnection(); // Get a connection for multiple statements if needed

        // 1. Drop existing triggers to avoid conflicts
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_transaction_insert"); // In case we ran this before
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_transaction_update");
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_transaction_delete");
        await conn.query("DROP TRIGGER IF EXISTS trg_audit_transfer_insert");

        // 2. CREATE Trigger for TRANSACTION INSERT (New!)
        // This captures every income, expense, and transfer leg.
        console.log("Creating trg_audit_transaction_insert...");
        await conn.query(`
            CREATE TRIGGER trg_audit_transaction_insert
            AFTER INSERT ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Transaction_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES (
                    'TRANSACTION', 
                    'INSERT', 
                    NEW.Transaction_ID, 
                    NEW.Transaction_ID, 
                    NEW.User_ID, 
                    CONCAT(NEW.Transaction_Type, ': ', NEW.Amount, ' (', IFNULL(NEW.Description, 'No Desc'), ')'),
                    NOW()
                );
            END
        `);

        // 3. CREATE Trigger for TRANSFER INSERT (Specific to 'Transfer' table events)
        // This captures the high-level transfer intent.
        console.log("Creating trg_audit_transfer_insert...");
        await conn.query(`
            CREATE TRIGGER trg_audit_transfer_insert
            AFTER INSERT ON TRANSFER
            FOR EACH ROW
            BEGIN
                -- We need to fetch User_ID from one of the accounts since TRANSFER table doesn't strictly have User_ID (it relies on Accounts)
                -- But usually transfers are within same user. We'll try to get it from From_Account.
                DECLARE v_msg VARCHAR(255);
                DECLARE v_user_id INT;
                
                SELECT User_ID INTO v_user_id FROM ACCOUNT WHERE Account_ID = NEW.From_Account_ID;
                
                SET v_msg = CONCAT('Fund Transfer of ', NEW.Amount, ' ID:', NEW.Transfer_ID);
                
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES ('TRANSFER', 'TRANSFER', NEW.Transfer_ID, v_user_id, v_msg, NOW());
            END
        `);

        // 4. UPDATE Trigger for TRANSACTION UPDATE (Enriched)
        console.log("Updating trg_audit_transaction_update...");
        await conn.query(`
            CREATE TRIGGER trg_audit_transaction_update
            AFTER UPDATE ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                IF OLD.Amount != NEW.Amount OR OLD.Description != NEW.Description THEN
                    INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Transaction_ID, Changed_By_User_ID, Description, Timestamp)
                    VALUES (
                        'TRANSACTION', 
                        'UPDATE', 
                        NEW.Transaction_ID, 
                        NEW.Transaction_ID, 
                        NEW.User_ID, 
                        CONCAT('Updated Txn ', NEW.Transaction_ID, '. Old: ', OLD.Amount, ', New: ', NEW.Amount),
                        NOW()
                    );
                END IF;
            END
        `);

        // 5. UPDATE Trigger for TRANSACTION DELETE (Enriched)
        console.log("Updating trg_audit_transaction_delete...");
        await conn.query(`
            CREATE TRIGGER trg_audit_transaction_delete
            AFTER DELETE ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                VALUES (
                    'TRANSACTION', 
                    'DELETE', 
                    OLD.Transaction_ID, 
                    OLD.User_ID, 
                    CONCAT('Deleted Txn: ', OLD.Transaction_Type, ' of ', OLD.Amount),
                    NOW()
                );
            END
        `);

        conn.release();
        console.log("All triggers updated successfully!");
        process.exit(0);

    } catch (err) {
        console.error("Error updating triggers:", err);
        process.exit(1);
    }
}

updateAuditTriggers();
