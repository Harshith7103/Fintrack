const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Users ---");
    db.all("SELECT User_ID, Name, Email, Employment_Status, Monthly_Income FROM USERS", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);

        console.log("\n--- Transaction Counts per User ---");
        db.all("SELECT User_ID, COUNT(*) as Count, SUM(Amount) as TotalVolume FROM TRANSACTION_LOG GROUP BY User_ID", (err, rows) => {
            if (err) console.error(err);
            else console.table(rows);

            console.log("\n--- Savings Counts per User ---");
            db.all("SELECT User_ID, COUNT(*) as SavingsCount FROM SAVINGS GROUP BY User_ID", (err, rows) => {
                if (err) console.error(err);
                else console.table(rows);

                console.log("\n--- EMI Counts per User ---");
                db.all("SELECT User_ID, COUNT(*) as EMICount FROM EMI GROUP BY User_ID", (err, rows) => {
                    if (err) console.error(err);
                    else console.table(rows);
                });
            });
        });
    });
});
