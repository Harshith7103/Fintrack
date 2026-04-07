const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/fintrack.db');
const db = new sqlite3.Database(dbPath);

const currentMonth = new Date().toISOString().slice(0, 7);

db.serialize(() => {
    // 1. Find User
    db.all('SELECT User_ID, Name, Monthly_Income FROM USERS', [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Users found:', rows);

        if (rows.length > 0) {
            // Find 'Damini User' or use the first one
            const user = rows.find(u => u.Name.includes('Damini')) || rows[0];
            const userId = user.User_ID;
            console.log(`Checking for User: ${user.Name} (ID: ${userId})`);

            // 2. Total Balance
            db.get('SELECT COALESCE(SUM(Balance), 0) as total_balance FROM ACCOUNT WHERE User_ID = ?',
                [userId], (err, row) => {
                    if (err) console.error(err);
                    console.log('Total Balance (DB):', row.total_balance);
                });

            // 3. Monthly Expenses
            db.get(`SELECT COALESCE(SUM(Amount), 0) as monthly_expense 
                    FROM TRANSACTION_LOG 
                    WHERE User_ID = ? AND Transaction_Type = 'Expense' 
                    AND strftime('%Y-%m', Transaction_DateTime) = ?`,
                [userId, currentMonth], (err, row) => {
                    if (err) console.error(err);
                    console.log('Monthly Expenses (DB):', row.monthly_expense);
                });

            // 4. Monthly Income (Transaction Sum)
            db.get(`SELECT COALESCE(SUM(Amount), 0) as monthly_income 
                    FROM TRANSACTION_LOG 
                    WHERE User_ID = ? AND Transaction_Type = 'Income' 
                    AND strftime('%Y-%m', Transaction_DateTime) = ?`,
                [userId, currentMonth], (err, row) => {
                    if (err) console.error(err);
                    console.log('Monthly Income (Transactions):', row.monthly_income);
                });

            // 5. Account Breakdown
            db.all('SELECT Account_Name, Balance FROM ACCOUNT WHERE User_ID = ?', [userId], (err, rows) => {
                console.log('Accounts:', rows);
            });
        }
    });
});
