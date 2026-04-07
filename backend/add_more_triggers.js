const db = require('./db');

const addMissingTriggers = async () => {
    try {
        console.log('Adding missing PL/SQL triggers for UPDATE and DELETE...');

        // 1. UPDATE TRIGGER
        await db.query(`DROP TRIGGER IF EXISTS trg_update_balance_on_update`);
        await db.query(`
            CREATE TRIGGER trg_update_balance_on_update
            AFTER UPDATE ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                -- Revert old balance
                IF OLD.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT SET Balance = Balance - OLD.Amount WHERE Account_ID = OLD.Account_ID;
                ELSEIF OLD.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT SET Balance = Balance + OLD.Amount WHERE Account_ID = OLD.Account_ID;
                END IF;

                -- Apply new balance
                IF NEW.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT SET Balance = Balance + NEW.Amount WHERE Account_ID = NEW.Account_ID;
                ELSEIF NEW.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT SET Balance = Balance - NEW.Amount WHERE Account_ID = NEW.Account_ID;
                END IF;
            END
        `);
        console.log('✅ trg_update_balance_on_update created successfully.');

        // 2. DELETE TRIGGER
        await db.query(`DROP TRIGGER IF EXISTS trg_update_balance_on_delete`);
        await db.query(`
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
        console.log('✅ trg_update_balance_on_delete created successfully.');

    } catch (err) {
        console.error('Failed to add PL/SQL missing triggers:', err);
    } finally {
        process.exit();
    }
};

addMissingTriggers();
