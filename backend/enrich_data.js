const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

console.log("🚀 Starting Data Enrichment...");

// Helper to POST data
const post = (path, data) => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api' + path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    resolve(body);
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
};

// Helper for GET data
const get = (path) => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api' + path,
            method: 'GET',
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    resolve(body);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

const enrichUser = async (user) => {
    console.log(`\n🔹 Enriching User: ${user.Name} (ID: ${user.User_ID})...`);
    const userId = user.User_ID;

    // 1. Fetch Accounts & Categories
    const accounts = await get(`/accounts/${userId}`);
    const categories = await get(`/categories/${userId}`);

    if (!Array.isArray(accounts) || accounts.length === 0) {
        console.log("   ⚠️ No accounts found. Skipping transactions.");
        return;
    }
    if (!Array.isArray(categories) || categories.length === 0) {
        console.log("   ⚠️ No categories found. Skipping transactions.");
        return;
    }

    // 2. Add Transactions (15-20)
    console.log("   ➕ Adding 15 Transactions...");
    const descriptions = [
        "Grocery Shopping", "Uber Ride", "Netflix", "Amazon Purchase",
        "Dinner Out", "Mobile Bill", "Internet Bill", "Petrol",
        "Movie Tickets", "Coffee", "Gym Subscription", "Pharmacy"
    ];

    for (let i = 0; i < 15; i++) {
        try {
            const acc = accounts[Math.floor(Math.random() * accounts.length)];
            const isExpense = Math.random() > 0.2; // 80% expense

            // Filter categories
            const type = isExpense ? 'Expense' : 'Income';
            const possibleCats = categories.filter(c => c.Category_Type === type);
            const cat = possibleCats.length > 0 ? possibleCats[Math.floor(Math.random() * possibleCats.length)] : categories[0];

            const amount = isExpense
                ? Math.floor(Math.random() * 3000) + 100
                : Math.floor(Math.random() * 5000) + 500;

            await post('/transactions', {
                user_id: userId,
                account_id: acc.Account_ID,
                category_id: cat.Category_ID,
                amount: amount,
                type: type,
                ref_type: 'Manual',
                description: descriptions[Math.floor(Math.random() * descriptions.length)] + ` #${i + 1}`
            });
        } catch (e) {
            console.error("Tx Error", e.message);
        }
    }

    // 3. Add Savings Goals (2-3)
    console.log("   ➕ Adding 2 Savings Goals...");
    const savingsGoals = ["Europe Trip", "New Laptop", "Emergency Fund", "Bike Upgrade", "Wedding Gift"];
    for (let i = 0; i < 2; i++) {
        const goal = savingsGoals[Math.floor(Math.random() * savingsGoals.length)] + " " + (i + 1);
        await post('/savings', {
            user_id: userId,
            goal_title: goal,
            target_amount: 100000 + (Math.random() * 50000),
            current_amount: 5000 + (Math.random() * 10000),
            start_date: new Date().toISOString().split('T')[0],
            target_date: '2028-01-01'
        });
    }

    // 4. Add EMIs (2)
    console.log("   ➕ Adding 2 EMIs...");
    const emiTitles = ["Personal Loan", "Home Appliance", "iPhone EMI", "Credit Card EMI"];
    for (let i = 0; i < 2; i++) {
        try {
            const acc = accounts[0];
            const cat = categories.find(c => c.Category_Name === 'Bills') || categories[0];

            await post('/emi', {
                user_id: userId,
                account_id: acc.Account_ID,
                category_id: cat.Category_ID,
                emi_title: emiTitles[Math.floor(Math.random() * emiTitles.length)] + " " + (i + 1),
                lender_name: "HDFC Bank",
                total_loan_amount: 50000 + (Math.random() * 50000),
                interest_rate: 12,
                tenure_months: 12,
                emi_amount: 2500 + (Math.random() * 1000),
                emi_day: 10,
                start_date: new Date().toISOString().split('T')[0],
                end_date: '2027-01-01'
            });
        } catch (e) { console.error("EMI Error", e.message); }
    }
};

// Main execution
db.all("SELECT * FROM USERS WHERE Name IN ('Jatin', 'Bhuvan', 'Rakesh', 'Madhuri', 'Akhil', 'Sanjay', 'Niranjan')", async (err, users) => {
    if (err) {
        console.error("Error fetching users:", err);
        return;
    }

    console.log(`Found ${users.length} users to enrich.`);
    for (const user of users) {
        await enrichUser(user);
    }
    console.log("\n✅ Enrichment Complete!");
});
