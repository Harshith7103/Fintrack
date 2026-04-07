const db = require('./db');

async function simulateLoginAudit() {
    try {
        console.log("Simulating Login Event to test Audit Log...");

        // 1. Get User 1
        const [users] = await db.query("SELECT User_ID FROM USERS LIMIT 1");
        if (users.length === 0) {
            console.log("No users found.");
            return;
        }
        const userId = users[0].User_ID;

        // 2. Calculate Stats (Same logic as in auth.js)
        const [stats] = await db.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END), 0) as Total_Income,
                COALESCE(SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END), 0) as Total_Expense
             FROM \`TRANSACTION\` WHERE User_ID = ?`,
            [userId]
        );

        const income = stats[0].Total_Income;
        const expense = stats[0].Total_Expense;
        const desc = `User Login. Lifetime Income: ${income}, Lifetime Expense: ${expense}`;

        console.log(`Calculated - Income: ${income}, Expense: ${expense}`);

        // 3. Insert Audit Log
        await db.query(
            `INSERT INTO AUDIT_LOG (Changed_By_User_ID, Action_Type, Table_Name, Description, Timestamp)
             VALUES (?, 'LOGIN', 'SYSTEM', ?, NOW())`,
            [userId, desc]
        );

        console.log("✅ Audit Log entry created! Please refresh the Audit Log page in your app.");
        process.exit(0);

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

simulateLoginAudit();
