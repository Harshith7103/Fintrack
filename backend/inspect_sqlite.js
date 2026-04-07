const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const files = ['fintrack.db', 'database.sqlite'];
const usersToFind = ['damini', 'jatin', 'bhuvan', 'sanjay', 'niranjan'];

files.forEach(file => {
    const dbPath = path.join(__dirname, file);
    console.log(`\n--- Inspecting ${file} ---`);

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(`Error opening ${file}:`, err.message);
            return;
        }
    });

    // Check Users
    db.all("SELECT User_ID, Name, Email FROM USERS", [], (err, rows) => {
        if (err) {
            console.log(`Error reading USERS from ${file}:`, err.message);
        } else {
            console.log(`Found ${rows.length} users in ${file}.`);
            const foundStats = rows.filter(r => usersToFind.some(u => r.Name.toLowerCase().includes(u) || r.Email.toLowerCase().includes(u)));
            foundStats.forEach(u => console.log(`  FOUND: ${u.Name} (${u.Email})`));

            if (foundStats.length > 0) {
                console.log(`✅ MATCH: This file likely contains the requested data.`);
            }
        }
    });

    // Check Transactions count
    db.get("SELECT Count(*) as count FROM TRANSACTION_LOG", [], (err, row) => {
        if (err) {
            // Try TRANSACTION table if LOG fails
            db.get("SELECT Count(*) as count FROM TRANSACTION", [], (err2, row2) => {
                if (err2) console.log(`Could not read transactions from ${file}`);
                else console.log(`Transactions count: ${row2.count}`);
            });
        } else {
            console.log(`Transactions count: ${row.count}`);
        }
    });
});
