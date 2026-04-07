const db = require('./db');

async function backfillBudgetHistory() {
    try {
        console.log("Backfilling historical BUDGET actions into Audit Log...");
        const conn = await db.getConnection();

        // 1. Created Budgets (From BUDGET table)
        const [budgets] = await conn.query("SELECT * FROM BUDGET");
        console.log(`Found ${budgets.length} existing budgets.`);

        for (const b of budgets) {
            // Since BUDGET table doesn't have Created_At, we'll try to use today or a fixed date if needed.
            // Or better, check if Audit Log already has it. If not, insert with NOW() or a placeholder.
            // But 'Month_Year' gives us a clue. Let's use the 1st of that month.
            const budgetDate = new Date(b.Month_Year + '-01');

            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Budget_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'BUDGET', 'INSERT', ?, ?, ?, CONCAT('Created Budget: ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'BUDGET' AND Record_ID = ? AND Action_Type = 'INSERT'
                )
            `, [b.Budget_ID, b.Budget_ID, b.User_ID, b.Budget_Amount, budgetDate, b.Budget_ID]);
        }

        // Note: The previous "BUDGET_V2" attempts failed because that table might not exist in the actual DB schema yet 
        // (the user might be using the simpler 'BUDGET' table schema shown in 01_create_tables.sql).
        // I am now strictly using the 'BUDGET' table I saw in 01_create_tables.sql.

        conn.release();
        console.log("Budget history backfill complete!");
        process.exit(0);

    } catch (err) {
        console.error("Error backfilling budget history:", err);
        process.exit(1);
    }
}

backfillBudgetHistory();
