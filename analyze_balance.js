const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/fintrack.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all(`SELECT Transaction_DateTime, Transaction_Type, Amount, Description 
            FROM TRANSACTION_LOG 
            WHERE User_ID = 1 
            ORDER BY Transaction_DateTime ASC`, [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log("--- TRANSACTION HISTORY ---");
        let runningBalance = 0;
        let incomeSum = 0;
        let expenseSum = 0;

        rows.forEach(row => {
            if (row.Transaction_Type === 'Income') {
                runningBalance += row.Amount;
                incomeSum += row.Amount;
            } else {
                runningBalance -= row.Amount;
                expenseSum += row.Amount;
            }
            console.log(`[${row.Transaction_DateTime}] ${row.Transaction_Type.padEnd(7)} ${row.Amount.toString().padStart(8)} | ${row.Description} | Bal: ${runningBalance}`);
        });

        console.log("\n--- SUMMARY ---");
        console.log("Total Income (Transactions):", incomeSum);
        console.log("Total Expenses (Transactions):", expenseSum);
        console.log("Calculated Balance (Income - Expense):", runningBalance);

        db.get("SELECT SUM(Balance) as ActualBalance FROM ACCOUNT WHERE User_ID = 1", (err, acc) => {
            console.log("Actual Account Balance:", acc.ActualBalance);
            console.log("Difference:", acc.ActualBalance - runningBalance);
        });
    });
});
