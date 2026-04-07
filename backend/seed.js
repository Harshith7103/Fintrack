const http = require('http');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const populateData = async () => {
    console.log("🌱 Starting Data Seeding...");

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

    try {
        // 1. Create Demo User with Password
        console.log("Creating Demo User...");
        const userResult = await post('/auth/register', {
            name: "Rahul Sharma",
            email: "john@example.com",
            phone: "9876543210",
            address: "Koramangala, Bangalore, Karnataka",
            occupation: "Software Engineer",
            monthly_income: 85000,
            password: "password123"
        });

        console.log("User Created:", userResult);
        const userId = userResult.id;

        // 2. Create Accounts
        console.log("Creating Accounts...");
        const salaryAcc = await post('/accounts', {
            user_id: userId,
            account_name: "HDFC Salary Account",
            account_type: "Salary",
            balance: 124580
        });
        const walletAcc = await post('/accounts', {
            user_id: userId,
            account_name: "Paytm Wallet",
            account_type: "Wallet",
            balance: 1200
        });

        console.log("Accounts created!");

        // 3. Transactions (History with Indian context)
        console.log("Injecting Transactions...");

        // Salary Credit
        await post('/transactions', {
            user_id: userId, account_id: salaryAcc.id, category_id: 1,
            amount: 85000, type: 'Income', ref_type: 'Salary'
        });

        // Indian Expenses
        await post('/transactions', {
            user_id: userId, account_id: salaryAcc.id, category_id: 2,
            amount: 18000, type: 'Expense', ref_type: 'Manual' // House Rent
        });

        await post('/transactions', {
            user_id: userId, account_id: salaryAcc.id, category_id: 3,
            amount: 4500, type: 'Expense', ref_type: 'Manual' // Grocery (Big Basket)
        });

        await post('/transactions', {
            user_id: userId, account_id: walletAcc.id, category_id: 4,
            amount: 450, type: 'Expense', ref_type: 'Manual' // Swiggy
        });

        await post('/transactions', {
            user_id: userId, account_id: salaryAcc.id, category_id: 5,
            amount: 2850, type: 'Expense', ref_type: 'Manual' // Electricity Bill
        });

        await post('/transactions', {
            user_id: userId, account_id: walletAcc.id, category_id: 6,
            amount: 299, type: 'Expense', ref_type: 'Manual' // Mobile Recharge
        });

        console.log("✅ Database Populated Successfully!");
        console.log("\n📋 Demo Login Credentials:");
        console.log("   Email: john@example.com");
        console.log("   Password: password123\n");

    } catch (err) {
        console.error("❌ Seeding Failed:", err.message);
    }
};

populateData();

