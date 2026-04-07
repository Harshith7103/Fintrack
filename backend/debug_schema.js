const db = require('./db');

async function debugSchema() {
    try {
        console.log("--- AUDIT_LOG Columns ---");
        const [auditCols] = await db.query("DESC AUDIT_LOG");
        auditCols.forEach(col => console.log(col.Field));

        console.log("\n--- TRANSACTION Columns ---");
        const [txnCols] = await db.query("DESC `TRANSACTION`");
        txnCols.forEach(col => console.log(col.Field));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugSchema();
