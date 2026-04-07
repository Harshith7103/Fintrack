const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

const defaultCategories = [
    { name: 'Food', type: 'Expense' },
    { name: 'Travel', type: 'Expense' },
    { name: 'Bills', type: 'Expense' },
    { name: 'Salary', type: 'Income' },
    { name: 'Freelance', type: 'Income' },
    { name: 'Investments', type: 'Income' }
];

db.serialize(() => {
    // 1. Get User ID
    db.get("SELECT User_ID FROM USERS WHERE Email = ?", ['damini123@gmail.com'], (err, user) => {
        if (err) {
            console.error("Error fetching user:", err);
            return;
        }
        if (!user) {
            console.error("User damini123@gmail.com not found!");
            return;
        }

        const userId = user.User_ID;
        console.log(`Found User ID: ${userId}`);

        // 2. Check Categories
        db.all("SELECT * FROM CATEGORY WHERE User_ID = ?", [userId], (err, rows) => {
            if (err) {
                console.error("Error checking categories:", err);
                return;
            }

            if (rows.length === 0) {
                console.log("No categories found. Seeding...");
                const stmt = db.prepare("INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)");
                defaultCategories.forEach(cat => {
                    stmt.run(userId, cat.name, cat.type);
                });
                stmt.finalize(() => {
                    console.log("Categories seeded!");
                });
            } else {
                console.log("Categories already exist:", rows.map(r => r.Category_Name));
            }
        });

        // 3. Print Transactions to debug
        db.all("SELECT * FROM TRANSACTION_LOG WHERE User_ID = ?", [userId], (err, rows) => {
            console.log("--- Transactions ---");
            console.log(rows);
        });
    });
});
