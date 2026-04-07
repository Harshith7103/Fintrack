const db = require('./db');
const { TransactionMongo, initMongoDB } = require('./mongodb');

async function seedVisuals() {
    console.log("🚀 Seeding visual data for Admin Dashboard...");
    await initMongoDB();
    try {
        const [users] = await db.query('SELECT User_ID FROM USERS');
        if (users.length === 0) {
            console.log("❌ No users found in MySQL. Register some first.");
            process.exit(1);
        }

        const [categories] = await db.query('SELECT Category_ID, Category_Name FROM CATEGORY');
        const [accounts] = await db.query('SELECT Account_ID, User_ID FROM ACCOUNT');

        const descriptions = [
            "Uber Ride", "Netflix", "Amazon", "Starbucks", "Grocery", "Rent", 
            "Salary Deposit", "Bonus", "Dividend", "Stock Sale", "Freelance", 
            "Zomato", "Electricity", "Gym", "Pharmacy", "Insurance"
        ];

        console.log(`Found ${users.length} users. Generating history for each...`);

        for (const user of users) {
            const userId = user.User_ID;
            const userAccs = accounts.filter(a => a.User_ID === userId);
            if (userAccs.length === 0) continue;

            const userCats = categories;
            
            // 1. Give every account a large initial balance to support expenses
            for (const acc of userAccs) {
                const incomeCat = categories.find(c => c.Category_Name === 'Salary') || categories[0];
                await db.query(
                    `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, acc.Account_ID, incomeCat.Category_ID, 200000, 'Income', 'Salary', 'Opening Credit', new Date(Date.now() - 31*24*60*60*1000)]
                );
            }

            // 2. Generate 40-60 transactions over the last 30 days
            const txnLimit = Math.floor(Math.random() * 20) + 40;
            for (let i = 0; i < txnLimit; i++) {
                const isExpense = Math.random() > 0.3;
                const type = isExpense ? 'Expense' : 'Income';
                const amount = isExpense ? Math.floor(Math.random() * 5000) + 200 : Math.floor(Math.random() * 25000) + 5000;
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 30));
                
                const acc = userAccs[Math.floor(Math.random() * userAccs.length)];
                const catId = categories[Math.floor(Math.random() * categories.length)].Category_ID;
                const desc = descriptions[Math.floor(Math.random() * descriptions.length)];

                await db.query(
                    `INSERT INTO \`TRANSACTION\` (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, acc.Account_ID, catId, amount, type, 'Manual', desc, date]
                );
            }
        }

        console.log("✅ MySQL Seeding Complete.");
        
        // Trigger MongoDB Sync via utility
        console.log("🔄 Syncing to MongoDB...");
        const { syncAllSqlTransactionsToMongo } = require('./utils/syncHelper');
        await syncAllSqlTransactionsToMongo();
        console.log("✅ MongoDB Sync Complete.");

        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    }
}

seedVisuals();
