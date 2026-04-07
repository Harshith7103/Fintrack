const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend', 'fintrack.db');
const db = new sqlite3.Database(dbPath);

const categories = [
    { user_id: 1, name: 'Salary', type: 'Income' },
    { user_id: 1, name: 'Food', type: 'Expense' },
    { user_id: 1, name: 'Travel', type: 'Expense' },
    { user_id: 1, name: 'Bills', type: 'Expense' },
    { user_id: 1, name: 'Shopping', type: 'Expense' },
    { user_id: 1, name: 'Rent', type: 'Expense' }
];

db.serialize(() => {
    console.log("Checking categories...");
    db.get("SELECT COUNT(*) as count FROM CATEGORY", (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }

        if (row.count === 0) {
            console.log("Seeding categories...");
            const stmt = db.prepare("INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)");
            categories.forEach(cat => {
                stmt.run(cat.user_id, cat.name, cat.type);
            });
            stmt.finalize();
            console.log("Categories seeded!");
        } else {
            console.log("Categories already exist. Count:", row.count);
        }
    });
});

db.close();
