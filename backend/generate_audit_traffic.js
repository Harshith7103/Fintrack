const db = require('./db');

async function generateAuditTraffic() {
    try {
        console.log("Generating Audit Traffic...");

        // 1. Get a User (User_ID 1)
        const [users] = await db.query("SELECT User_ID FROM USERS LIMIT 1");
        if (users.length === 0) {
            console.log("No users found. Please seed users first.");
            return;
        }
        const userId = users[0].User_ID;
        console.log(`Using User ID: ${userId}`);

        // Get an account for transactions
        const [accounts] = await db.query("SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? LIMIT 1", [userId]);
        let accountId;
        if (accounts.length > 0) {
            accountId = accounts[0].Account_ID;
        } else {
            // Create dummy account if none exists
            const [accResult] = await db.query("INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, 'Audit Test Bank', 'Bank', 10000)", [userId]);
            accountId = accResult.insertId;
        }

        // --- SCENARIO 1: TRANSACTION UPDATES & DELETES ---
        console.log("1. Creating a temporary transaction...");
        const [txnResult] = await db.query(
            "INSERT INTO `TRANSACTION` (User_ID, Account_ID, Amount, Transaction_Type, Description) VALUES (?, ?, 1000, 'Expense', 'Temp Audit txn')",
            [userId, accountId]
        );
        const txnId = txnResult.insertId;

        console.log("2. Updating transaction amount (Triggers UPDATE Log)...");
        // Trigger: trg_audit_transaction_update (Checks for Amount change)
        await db.query("UPDATE `TRANSACTION` SET Amount = 1500 WHERE Transaction_ID = ?", [txnId]);

        console.log("3. Deleting transaction (Triggers DELETE Log)...");
        // Trigger: trg_audit_transaction_delete
        await db.query("DELETE FROM `TRANSACTION` WHERE Transaction_ID = ?", [txnId]);


        // --- SCENARIO 2: BUDGET UPDATES ---
        // Get or Create a category
        const [cats] = await db.query("SELECT Category_ID FROM CATEGORY WHERE User_ID = ? LIMIT 1", [userId]);
        let catId;
        if (cats.length > 0) {
            catId = cats[0].Category_ID;
        } else {
            const [cRes] = await db.query("INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, 'Audit Cat', 'Expense')", [userId]);
            catId = cRes.insertId;
        }

        console.log("4. Creating a budget...");
        // Check if budget exists, if so update it, else insert
        const [budgets] = await db.query("SELECT Budget_ID FROM BUDGET WHERE User_ID = ? AND Category_ID = ?", [userId, catId]);

        let budgetId;
        if (budgets.length > 0) {
            budgetId = budgets[0].Budget_ID;
            console.log("5. Updating existing budget (Triggers UPDATE Log)...");
            await db.query("UPDATE BUDGET SET Budget_Amount = Budget_Amount + 500 WHERE Budget_ID = ?", [budgetId]);
        } else {
            const [bRes] = await db.query("INSERT INTO BUDGET (User_ID, Category_ID, Budget_Amount, Month_Year) VALUES (?, ?, 5000, '2025-01')", [userId, catId]);
            budgetId = bRes.insertId;
            console.log("5. Updating new budget (Triggers UPDATE Log)...");
            await db.query("UPDATE BUDGET SET Budget_Amount = 6000 WHERE Budget_ID = ?", [budgetId]);
        }


        // --- SCENARIO 3: SAVINGS UPDATES ---
        console.log("6. Creating a savings goal...");
        const [sRes] = await db.query("INSERT INTO SAVINGS (User_ID, Goal_Title, Target_Amount, Start_Date) VALUES (?, 'Audit Goal', 50000, NOW())", [userId]);
        const goalId = sRes.insertId;

        console.log("7. Updating savings target (Triggers UPDATE Log)...");
        // Trigger: trg_audit_savings_update (Checks Target_Amount change)
        await db.query("UPDATE SAVINGS SET Target_Amount = 60000 WHERE Goal_ID = ?", [goalId]);

        // Cleanup savings goal (optional, lets keep it so user sees it)
        // await db.query("DELETE FROM SAVINGS WHERE Goal_ID = ?", [goalId]);

        console.log("Audit traffic generation complete. Check the Audit Log page.");
        process.exit(0);

    } catch (err) {
        console.error("Error generating audit logs:", err);
        process.exit(1);
    }
}

generateAuditTraffic();
