const db = require('./db');

async function backfillBudgetV2History() {
    try {
        console.log("Backfilling historical BUDGET_V2 actions into Audit Log...");
        const conn = await db.getConnection();

        // 1. Created Active Budgets
        const [activeBudgets] = await conn.query("SELECT * FROM BUDGET_V2 WHERE Status = 'Active'");
        console.log(`Found ${activeBudgets.length} active budgets.`);
        for (const b of activeBudgets) {
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'BUDGET_V2', 'INSERT', ?, ?, ?, CONCAT('Created Budget: ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'BUDGET_V2' AND Record_ID = ? AND Action_Type = 'INSERT'
                )
            `, [b.Budget_ID, b.Budget_ID, b.User_ID, b.Budget_Name, b.Created_At, b.Budget_ID]);
        }

        // 2. Deleted Budgets (Soft Deleted)
        const [deletedBudgets] = await conn.query("SELECT * FROM BUDGET_V2 WHERE Status = 'Deleted'");
        console.log(`Found ${deletedBudgets.length} deleted budgets.`);
        for (const b of deletedBudgets) {
            // Log Creation (if missing)
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'BUDGET_V2', 'INSERT', ?, ?, ?, CONCAT('Created Budget: ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'BUDGET_V2' AND Record_ID = ? AND Action_Type = 'INSERT'
                )
            `, [b.Budget_ID, b.Budget_ID, b.User_ID, b.Budget_Name, b.Created_At, b.Budget_ID]);

            // Log Deletion
            const deleteTime = b.Updated_At || new Date(new Date(b.Created_At).getTime() + 1000 * 60 * 60);

            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'BUDGET_V2', 'DELETE', ?, ?, ?, CONCAT('Deleted Budget: ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'BUDGET_V2' AND Record_ID = ? AND Action_Type = 'DELETE'
                )
            `, [b.Budget_ID, b.Budget_ID, b.User_ID, b.Budget_Name, deleteTime, b.Budget_ID]);
        }

        conn.release();
        console.log("Budget history backfill complete!");
        process.exit(0);

    } catch (err) {
        console.error("Error backfilling budget history:", err);
        process.exit(1);
    }
}

backfillBudgetV2History();
