const db = require('./db');

async function updateAuditEnum() {
    try {
        console.log("Updating AUDIT_LOG Action_Type ENUM...");
        const conn = await db.getConnection();

        // Check if Action_Type is ENUM or VARCHAR
        const [cols] = await conn.query("SHOW COLUMNS FROM AUDIT_LOG WHERE Field = 'Action_Type'");
        const type = cols[0].Type;
        console.log(`Current Type: ${type}`);

        if (type.includes('enum')) {
            console.log("Altering ENUM to include LOGIN, TRANSFER, CREATE...");
            // Extract existing values and add new ones
            // Or just replace with superset
            await conn.query("ALTER TABLE AUDIT_LOG MODIFY COLUMN Action_Type ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'TRANSFER', 'CREATE', 'REGISTER')");
            console.log("ENUM updated successfully.");
        } else {
            console.log("Action_Type is not ENUM (likely VARCHAR), no change needed.");
        }

        conn.release();
        process.exit(0);

    } catch (err) {
        console.error("Error updating ENUM:", err);
        process.exit(1);
    }
}

updateAuditEnum();
