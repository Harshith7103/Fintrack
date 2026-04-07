const db = require('./db');

async function fixAuditSchema() {
    try {
        console.log("Fixing AUDIT_LOG schema...");

        // Add missing columns
        // We'll try adding them one by one. If they exist, it might error, so we catch errors.

        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD COLUMN Transaction_ID INT");
            console.log("Added Transaction_ID column.");
        } catch (e) { console.log("Transaction_ID column might already exist or error: " + e.message); }

        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD COLUMN Budget_ID INT");
            console.log("Added Budget_ID column.");
        } catch (e) { console.log("Budget_ID column might already exist or error: " + e.message); }

        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD COLUMN Goal_ID INT");
            console.log("Added Goal_ID column.");
        } catch (e) { console.log("Goal_ID column might already exist or error: " + e.message); }

        // Add foreign keys (optional but good)
        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD FOREIGN KEY (Transaction_ID) REFERENCES `TRANSACTION`(Transaction_ID) ON DELETE SET NULL");
            console.log("Added FK for Transaction_ID.");
        } catch (e) { console.log("FK Transaction_ID error: " + e.message); }

        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD FOREIGN KEY (Budget_ID) REFERENCES BUDGET(Budget_ID) ON DELETE SET NULL");
            console.log("Added FK for Budget_ID.");
        } catch (e) { console.log("FK Budget_ID error: " + e.message); }

        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD FOREIGN KEY (Goal_ID) REFERENCES SAVINGS(Goal_ID) ON DELETE SET NULL");
            console.log("Added FK for Goal_ID.");
        } catch (e) { console.log("FK Goal_ID error: " + e.message); }

        console.log("Schema fix complete.");
        process.exit(0);
    } catch (err) {
        console.error("Critical error fixing schema:", err);
        process.exit(1);
    }
}

fixAuditSchema();
