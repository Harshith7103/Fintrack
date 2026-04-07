const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Checking for Duplicate Categories ---");
    const sql = `
        SELECT User_ID, Category_Name, COUNT(*) as Count, GROUP_CONCAT(Category_ID) as IDs
        FROM CATEGORY
        GROUP BY User_ID, Category_Name
        HAVING COUNT(*) > 1
    `;

    db.all(sql, (err, rows) => {
        if (err) console.error(err);
        else {
            if (rows.length === 0) {
                console.log("No duplicates found!");
            } else {
                console.table(rows);
            }
        }
    });
});
