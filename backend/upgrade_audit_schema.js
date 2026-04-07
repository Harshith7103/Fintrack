const db = require('./db');

async function upgradeAuditSchema() {
    try {
        console.log("Upgrading AUDIT_LOG schema for flexible events...");

        // 1. Modify Action_Type to VARCHAR to allow 'LOGIN', 'LOGOUT', 'ALERT', etc.
        // We drop the check constraint implicitly by modifying the column type.
        await db.query("ALTER TABLE AUDIT_LOG MODIFY COLUMN Action_Type VARCHAR(50) NOT NULL");
        console.log("Modified Action_Type to VARCHAR(50).");

        // 2. Add a Description column if it doesn't exist (to store "User logged in", etc.)
        // The original schema didn't have Description in AUDIT_LOG.
        try {
            await db.query("ALTER TABLE AUDIT_LOG ADD COLUMN Description VARCHAR(255)");
            console.log("Added Description column.");
        } catch (e) {
            console.log("Description column likely exists or error: " + e.message);
        }

        console.log("Schema upgrade complete. You can now use Audit Log for general events.");
        process.exit(0);

    } catch (err) {
        console.error("Error upgrading schema:", err);
        process.exit(1);
    }
}

upgradeAuditSchema();
