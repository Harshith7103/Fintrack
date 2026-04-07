const db = require('./db');
const { TransactionMongo } = require('./mongodb');

const GARBAGE_IDS = [3, 4, 5, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30];

async function nuclearPurge() {
    let conn;
    try {
        conn = await db.getConnection();
        
        console.log("Step 1: Dropping balance triggers...");
        await conn.query('DROP TRIGGER IF EXISTS trg_update_balance_on_delete');
        await conn.query('DROP TRIGGER IF EXISTS trg_update_balance_on_update');
        await conn.query('DROP TRIGGER IF EXISTS trg_update_balance_after_transaction');
        console.log("   Done.");
        
        await conn.query('SET FOREIGN_KEY_CHECKS=0');
        console.log("Step 2: FK checks disabled.");
        
        // Get all table names to know what exists
        const [tables] = await conn.query("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());
        console.log("   Tables found:", tableNames.join(', '));
        
        for (const id of GARBAGE_IDS) {
            console.log(`Purging User ID ${id}...`);
            
            const tryDel = async (table, col) => {
                try { await conn.query(`DELETE FROM \`${table}\` WHERE \`${col}\` = ?`, [id]); }
                catch(e) { /* table might not exist, skip */ }
            };
            
            await tryDel('AUDIT_LOG', 'Changed_By_User_ID');
            await tryDel('TRANSACTION', 'User_ID');
            await tryDel('EMI', 'User_ID');
            await tryDel('BUDGET', 'User_ID');
            await tryDel('BUDGET_V2', 'User_ID');
            await tryDel('FINANCIAL_GOAL', 'User_ID');
            await tryDel('ACCOUNT', 'User_ID');
            await tryDel('CATEGORY', 'User_ID');
            await tryDel('USER_PHONES', 'User_ID');
            await tryDel('NOTIFICATION', 'User_ID');
            await tryDel('SAVINGS', 'User_ID');
            await tryDel('SALARY', 'User_ID');
            await tryDel('MONTHLY_SUMMARY', 'User_ID');
            await tryDel('TRANSFER', 'User_ID');
            await tryDel('USERS', 'User_ID');
            
            try { await TransactionMongo.deleteMany({ user_id: id }); } catch(e){}
            
            console.log(`   User ${id} PURGED.`);
        }
        
        await conn.query('SET FOREIGN_KEY_CHECKS=1');
        console.log("Step 4: FK checks re-enabled.");
        
        console.log("Step 5: Recreating balance triggers...");
        
        await conn.query(`
            CREATE TRIGGER trg_update_balance_after_transaction
            AFTER INSERT ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                IF NEW.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT SET Balance = Balance + NEW.Amount WHERE Account_ID = NEW.Account_ID;
                ELSEIF NEW.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT SET Balance = Balance - NEW.Amount WHERE Account_ID = NEW.Account_ID;
                END IF;
            END
        `);
        
        await conn.query(`
            CREATE TRIGGER trg_update_balance_on_update
            AFTER UPDATE ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                IF OLD.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT SET Balance = Balance - OLD.Amount WHERE Account_ID = OLD.Account_ID;
                ELSEIF OLD.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT SET Balance = Balance + OLD.Amount WHERE Account_ID = OLD.Account_ID;
                END IF;
                IF NEW.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT SET Balance = Balance + NEW.Amount WHERE Account_ID = NEW.Account_ID;
                ELSEIF NEW.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT SET Balance = Balance - NEW.Amount WHERE Account_ID = NEW.Account_ID;
                END IF;
            END
        `);
        
        await conn.query(`
            CREATE TRIGGER trg_update_balance_on_delete
            AFTER DELETE ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                IF OLD.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT SET Balance = Balance - OLD.Amount WHERE Account_ID = OLD.Account_ID;
                ELSEIF OLD.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT SET Balance = Balance + OLD.Amount WHERE Account_ID = OLD.Account_ID;
                END IF;
            END
        `);
        
        console.log("   Triggers recreated.");
        
        conn.release();
        
        const [remaining] = await db.query('SELECT User_ID, Name, Email FROM USERS ORDER BY User_ID');
        console.log("\n========================================");
        console.log("REMAINING CLEAN USERS:");
        console.log("========================================");
        remaining.forEach(u => console.log(`  #${u.User_ID} ${u.Name} (${u.Email})`));
        console.log(`========================================`);
        console.log(`Total: ${remaining.length} users. ALL GARBAGE GONE!`);
        
        process.exit(0);
    } catch(e) {
        if(conn) {
            try { await conn.query('SET FOREIGN_KEY_CHECKS=1'); conn.release(); } catch(err){}
        }
        console.error("FATAL:", e);
        process.exit(1);
    }
}

nuclearPurge();
