const db = require('./db');

async function verify() {
    try {
        console.log("Verifying USERS table columns...");
        const [userCols] = await db.query("SHOW COLUMNS FROM USERS LIKE 'Phone_No'");
        if (userCols.length === 0) {
            console.log("PASS: Phone_No column not found in USERS.");
        } else {
            console.log("FAIL: Phone_No column still exists in USERS.");
        }

        console.log("Verifying USER_PHONES table...");
        const [phones] = await db.query("SELECT * FROM USER_PHONES");
        console.log(`PASS: USER_PHONES table exists with ${phones.length} records.`);
        console.log(phones);

        process.exit(0);
    } catch (err) {
        console.error("Verification failed:", err);
        process.exit(1);
    }
}

verify();
