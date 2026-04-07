const db = require('./db');

async function migrate() {
    console.log("Starting migration to multivalued phone numbers...");

    try {
        // 1. Create USER_PHONES table
        console.log("Creating USER_PHONES table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS USER_PHONES (
                Phone_ID INT AUTO_INCREMENT PRIMARY KEY,
                User_ID INT NOT NULL,
                Phone_No VARCHAR(20) NOT NULL,
                Is_Primary BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (User_ID) REFERENCES USERS(User_ID) ON DELETE CASCADE,
                UNIQUE (User_ID, Phone_No)
            )
        `);

        // 2. Check if Phone_No exists in USERS to migrate
        // We use a try-catch block or check column existence usually, but for this script we assume it might exist.
        // We'll check by trying to select it.
        try {
            const [users] = await db.query("SELECT User_ID, Phone_No FROM USERS");

            if (users.length > 0) {
                console.log(`Found ${users.length} users to migrate.`);

                for (const user of users) {
                    if (user.Phone_No) {
                        try {
                            await db.query(
                                "INSERT IGNORE INTO USER_PHONES (User_ID, Phone_No, Is_Primary) VALUES (?, ?, TRUE)",
                                [user.User_ID, user.Phone_No]
                            );
                            console.log(`Migrated phone for User ID ${user.User_ID}: ${user.Phone_No}`);
                        } catch (err) {
                            console.error(`Failed to migrate phone for User ID ${user.User_ID}: ${err.message}`);
                        }
                    }
                }
            } else {
                console.log("No users found to migrate.");
            }

            // 3. Drop Phone_No column from USERS
            // Only if we successfully selected it (meaning it existed)
            console.log("Dropping Phone_No column from USERS table...");
            // We need to drop constraints first if any.
            // Phone_No was UNIQUE in original schema.
            // We might need to drop the index/key.
            // Usually MySQL drops indices on the column when dropping the column.

            await db.query("ALTER TABLE USERS DROP COLUMN Phone_No");
            console.log("Dropped Phone_No column.");

        } catch (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR') {
                console.log("Phone_No column does not exist in USERS. Skipping migration.");
            } else {
                throw err;
            }
        }

        console.log("Migration completed successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
