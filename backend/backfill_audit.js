
const db = require('./db');
const crypto = require('crypto');

async function backfillAuditLogs() {
    try {
        console.log("Starting Backfill of Historical Records into AUDIT_LOG...");

        // 1. Backfill USERS (Creation)
        // We use Created_At from users table
        console.log("Backfilling User Registrations...");
        const [users] = await db.query('SELECT User_ID, Name, Created_At FROM USERS');
        for (const user of users) {
            // Check if audit already exists for this action
            const [exists] = await db.query(
                "SELECT Log_ID FROM AUDIT_LOG WHERE Table_Name = 'USERS' AND Record_ID = ? AND Action_Type = 'REGISTER'",
                [user.User_ID]
            );
            if (exists.length === 0) {
                await db.query(
                    `INSERT INTO AUDIT_LOG (Changed_By_User_ID, Action_Type, Table_Name, Record_ID, Description, Timestamp)
                      VALUES (?, 'REGISTER', 'USERS', ?, ?, ?)`,
                    [user.User_ID, user.User_ID, `User Registered: ${user.Name}`, user.Created_At]
                );
            }
        }

        // 2. Backfill TRANSACTIONS (Creation)
        console.log("Backfilling Transactions...");
        const [txns] = await db.query('SELECT Transaction_ID, User_ID, Amount, Transaction_Type, Description, Transaction_DateTime FROM `TRANSACTION`');

        let txnCount = 0;
        for (const txn of txns) {
            const [exists] = await db.query(
                "SELECT Log_ID FROM AUDIT_LOG WHERE Table_Name = 'TRANSACTION' AND Record_ID = ? AND Action_Type = 'INSERT'",
                [txn.Transaction_ID]
            );

            if (exists.length === 0) {
                const desc = `${txn.Transaction_Type}: ${txn.Amount} (${txn.Description || 'No Desc'})`;
                await db.query(
                    `INSERT INTO AUDIT_LOG (Changed_By_User_ID, Action_Type, Table_Name, Record_ID, Transaction_ID, Description, Timestamp)
                     VALUES (?, 'INSERT', 'TRANSACTION', ?, ?, ?, ?)`,
                    [txn.User_ID, txn.Transaction_ID, txn.Transaction_ID, desc, txn.Transaction_DateTime]
                );
                txnCount++;
            }
        }
        console.log(`Backfilled ${txnCount} transactions.`);

        // 3. Backfill SAVINGS (Goal Creation)
        console.log("Backfilling Savings Goals...");
        const [goals] = await db.query('SELECT Goal_ID, User_ID, Goal_Title, Target_Amount, Start_Date FROM SAVINGS');
        for (const goal of goals) {
            const [exists] = await db.query(
                "SELECT Log_ID FROM AUDIT_LOG WHERE Table_Name = 'SAVINGS' AND Record_ID = ? AND Action_Type = 'INSERT'",
                [goal.Goal_ID]
            );

            if (exists.length === 0) {
                await db.query(
                    `INSERT INTO AUDIT_LOG (Changed_By_User_ID, Action_Type, Table_Name, Record_ID, Goal_ID, Description, Timestamp)
                      VALUES (?, 'INSERT', 'SAVINGS', ?, ?, ?, ?)`,
                    [goal.User_ID, goal.Goal_ID, goal.Goal_ID, `Goal Created: ${goal.Goal_Title} (${goal.Target_Amount})`, goal.Start_Date] // Using Start_Date as timestamp roughly
                );
            }
        }

        // 4. Backfill ACCOUNTS (Creation)
        console.log("Backfilling Account Creations...");
        const [accounts] = await db.query('SELECT Account_ID, User_ID, Account_Name, Created_At FROM ACCOUNT');
        for (const acc of accounts) {
            const [exists] = await db.query(
                "SELECT Log_ID FROM AUDIT_LOG WHERE Table_Name = 'ACCOUNT' AND Record_ID = ? AND Action_Type = 'CREATE'",
                [acc.Account_ID]
            );
            if (exists.length === 0) {
                await db.query(
                    `INSERT INTO AUDIT_LOG (Changed_By_User_ID, Action_Type, Table_Name, Record_ID, Description, Timestamp)
                      VALUES (?, 'CREATE', 'ACCOUNT', ?, ?, ?)`,
                    [acc.User_ID, acc.Account_ID, `Account Created: ${acc.Account_Name}`, acc.Created_At]
                );
            }
        }

        console.log("Backfill Complete! Old records are now visible in Audit Log.");
        process.exit(0);

    } catch (err) {
        console.error("Error backfilling audit logs:", err);
        process.exit(1);
    }
}

backfillAuditLogs();
