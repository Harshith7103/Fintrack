const db = require('./db');

async function checkAuditRows() {
    try {
        console.log("Checking Audit Rows...");
        const [rows] = await db.query("SELECT * FROM AUDIT_LOG ORDER BY Timestamp DESC LIMIT 10");
        console.log(`Found ${rows.length} rows.`);
        rows.forEach(r => {
            console.log(`[${r.Action_Type}] Table: ${r.Table_Name}, User: ${r.Changed_By_User_ID}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkAuditRows();
