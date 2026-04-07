const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/fintrack.db');
const db = new sqlite3.Database(dbPath);

const userId = 1;

db.serialize(() => {
    db.all(
        `SELECT 
        strftime('%Y-%m', Transaction_DateTime) as month,
        SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END) as income,
        SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END) as expense
        FROM TRANSACTION_LOG
        WHERE User_ID = ?
        AND Transaction_DateTime >= date('now', '-6 months')
        GROUP BY month
        ORDER BY month`,
        [userId],
        (err, trend) => {
            if (err) console.error(err);
            console.log("Trend Data in DB:", trend);
        }
    );
});
