const db = require('./db');

async function backfillAllRemainingHistory() {
    try {
        console.log("Backfilling remaining historical system actions into Audit Log (EMI, SALARY, CATEGORY)...");
        const conn = await db.getConnection();

        // 1. EMI (Loan Creation)
        console.log("Backfilling Loans (EMI)...");
        const [emis] = await conn.query("SELECT * FROM EMI");
        for (const e of emis) {
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'EMI', 'INSERT', ?, ?, CONCAT('Loan Started: ', ?, ' (₹', ?, ')'), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'EMI' AND Record_ID = ? AND Action_Type = 'INSERT'
                )
            `, [e.EMI_ID, e.User_ID, e.EMI_Title, e.Total_Loan_Amount, e.Start_Date, e.EMI_ID]);
        }

        // 2. SALARY (Salary Setup)
        console.log("Backfilling Salary Configurations...");
        const [salaries] = await conn.query("SELECT * FROM SALARY");
        for (const s of salaries) {
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'SALARY', 'INSERT', ?, ?, CONCAT('Salary Configured: ₹', ?, ' on day ', ?), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'SALARY' AND Record_ID = ? AND Action_Type = 'INSERT'
                )
            `, [s.Salary_ID, s.User_ID, s.Amount, s.Salary_Day, s.Created_At || new Date(), s.Salary_ID]);
        }

        // 3. CATEGORY (Custom Categories)
        console.log("Backfilling Categories...");
        const [categories] = await conn.query("SELECT * FROM CATEGORY");
        for (const c of categories) {
            await conn.query(`
                INSERT INTO AUDIT_LOG (Table_Name, Action_Type, Record_ID, Changed_By_User_ID, Description, Timestamp)
                SELECT 'CATEGORY', 'INSERT', ?, ?, CONCAT('Category Created: ', ?, ' (', ?, ')'), ?
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM AUDIT_LOG 
                    WHERE Table_Name = 'CATEGORY' AND Record_ID = ? AND Action_Type = 'INSERT'
                )
            `, [c.Category_ID, c.User_ID, c.Category_Name, c.Category_Type, c.Created_At || new Date(), c.Category_ID]);
        }

        conn.release();
        console.log("Full history backfill complete!");
        process.exit(0);

    } catch (err) {
        console.error("Error backfilling remaining history:", err);
        process.exit(1);
    }
}

backfillAllRemainingHistory();
