const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Categories ---");
    db.all("SELECT * FROM CATEGORY", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });

    console.log("\n--- Transactions ---");
    db.all("SELECT * FROM TRANSACTION_LOG", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });

    console.log("\n--- Users ---");
    db.all("SELECT * FROM USERS", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });
});

db.close();
