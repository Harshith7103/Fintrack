const db = require('./db');

async function backfillInferredUpdates() {
    try {
        console.log("Backfilling inferred UDPATE/LOGIN history...");
        const conn = await db.getConnection();

        // 1. User Logins (from Last_Login)
        console.log("Backfilling User Logins...");
        const [users] = await conn.query("SELECT User_ID, Name, Last_Login FROM USERS WHERE Last_Login IS NOT NULL");
        for (const u of users) {
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'USERS', 'LOGIN', ?, ?, CONCAT('User Login: ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'USERS' AND Record_ID = ? AND Action_Type = 'LOGIN' AND Timestamp = ?
                )
            `, [u.User_ID, u.User_ID, u.Name, u.Last_Login, u.User_ID, u.Last_Login]);
        }

        // 2. EMI Payments (from Last_Deducted)
        console.log("Backfilling EMI Payments...");
        const [emis] = await conn.query("SELECT * FROM EMI WHERE Last_Deducted IS NOT NULL");
        for (const e of emis) {
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'EMI', 'UPDATE', ?, ?, CONCAT('EMI Auto-Deducted for ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'EMI' AND Record_ID = ? AND Action_Type = 'UPDATE' AND Description LIKE 'EMI Auto-Deducted%'
                )
            `, [e.EMI_ID, e.User_ID, e.EMI_Title, e.Last_Deducted, e.EMI_ID]);
        }

        // 3. Savings Progress (from Current_Amount)
        console.log("Backfilling Savings Progress...");
        const [savings] = await conn.query("SELECT * FROM SAVINGS WHERE Current_Amount > 0");
        for (const s of savings) {
            // Assume 1 update occurred recently or midway between Start and Target
            const updateTime = new Date(s.Start_Date);
            updateTime.setDate(updateTime.getDate() + 1); // Mock date: 1 day after start

            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'SAVINGS', 'UPDATE', ?, ?, CONCAT('Savings Updated: ₹', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'SAVINGS' AND Record_ID = ? AND Action_Type = 'UPDATE'
                )
            `, [s.Goal_ID, s.User_ID, s.Current_Amount, updateTime, s.Goal_ID]);
        }

        conn.release();
        console.log("Inferred update history backfill complete!");
        process.exit(0);

    } catch (err) {
        console.error("Error backfilling inferred updates:", err);
        process.exit(1);
    }
}

backfillInferredUpdates();
