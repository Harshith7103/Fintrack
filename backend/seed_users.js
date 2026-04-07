const http = require('http');

const USERS = [
    {
        name: "Jatin", email: "jatin123@gmail.com", phone: "9876540001",
        occupation: "Employee", monthly_income: 120000, employment_status: "Employee",
        persona: "High Earner",
        accounts: [
            { name: "HDFC Salary", type: "Bank", balance: 150000 },
            { name: "Cred Card", type: "Credit Card", balance: -15000 }
        ],
        transactions: 15, // Number of random transactions
        savings: [{ title: "New Car", target: 800000, current: 200000 }],
        emi: null,
        budgets: [{ category: "Food", amount: 15000 }, { category: "Travel", amount: 10000 }]
    },
    {
        name: "Bhuvan", email: "bhuvan123@gmail.com", phone: "9876540002",
        occupation: "Freelancer", monthly_income: 60000, employment_status: "Employee",
        persona: "Freelancer",
        accounts: [
            { name: "SBI Savings", type: "Bank", balance: 45000 },
            { name: "Paytm Wallet", type: "Wallet", balance: 2000 }
        ],
        transactions: 20,
        savings: [{ title: "MacBook Pro", target: 200000, current: 50000 }],
        emi: null,
        budgets: [{ category: "Bills", amount: 5000 }]
    },
    {
        name: "Rakesh", email: "rakesh123@gmail.com", phone: "9876540003",
        occupation: "Student", monthly_income: 0, employment_status: "Unemployed",
        persona: "Student",
        accounts: [
            { name: "Pocket Money", type: "Cash", balance: 5000 }
        ],
        transactions: 10,
        savings: [{ title: "Gaming Console", target: 30000, current: 5000 }],
        emi: null,
        budgets: [{ category: "Food", amount: 2000 }]
    },
    {
        name: "Madhuri", email: "madhuri123@gmail.com", phone: "9876540004",
        occupation: "Homemaker", monthly_income: 0, employment_status: "Unemployed",
        persona: "Homemaker",
        accounts: [
            { name: "Household Cash", type: "Cash", balance: 12000 },
            { name: "Joint Account", type: "Bank", balance: 50000 }
        ],
        transactions: 25, // Lots of grocery/household
        savings: [{ title: "Gold Jewellery", target: 500000, current: 150000 }],
        emi: null,
        budgets: [{ category: "Grocery", amount: 20000 }]
    },
    {
        name: "Akhil", email: "akhil123@gmail.com", phone: "9876540005",
        occupation: "Software Engineer", monthly_income: 95000, employment_status: "Employee",
        persona: "EMI Heavy",
        accounts: [
            { name: "ICICI Salary", type: "Bank", balance: 25000 }
        ],
        transactions: 12,
        savings: [],
        emi: { title: "Home Loan", amount: 35000, total: 5000000, tenure: 240 },
        budgets: []
    },
    {
        name: "Sanjay", email: "sanjay123@gmail.com", phone: "9876540006",
        occupation: "Business Owner", monthly_income: 250000, employment_status: "Employee",
        persona: "Business",
        accounts: [
            { name: "Current Account", type: "Bank", balance: 500000 },
            { name: "Cash Drawer", type: "Cash", balance: 50000 }
        ],
        transactions: 30, // High volume
        savings: [{ title: "Expansion Fund", target: 2000000, current: 1000000 }],
        emi: { title: "Car Loan", amount: 25000, total: 1500000, tenure: 60 },
        budgets: []
    },
    {
        name: "Niranjan", email: "niranjan123@gmail.com", phone: "9876540007",
        occupation: "Retired", monthly_income: 40000, employment_status: "Unemployed",
        persona: "Retired",
        accounts: [
            { name: "Pension Account", type: "Bank", balance: 800000 }
        ],
        transactions: 8, // Minimal
        savings: [{ title: "Emergency Fund", target: 100000, current: 80000 }],
        emi: null,
        budgets: [{ category: "Health", amount: 10000 }]
    }
];

const DEFAULT_PASSWORD = "123456";

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

const seedUser = async (user) => {
    console.log(`\n🚀 Seeding User: ${user.name} (${user.persona})...`);

    // 1. REGISTER
    let userData;
    try {
        console.log("   Registering...");
        const regRes = await post('/auth/register', {
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: "Bangalore, India",
            occupation: user.occupation,
            monthly_income: user.monthly_income,
            password: DEFAULT_PASSWORD,
            employment_status: user.employment_status || "Employee"
        });

        if (regRes.error) {
            if (regRes.error.includes("already exists") || regRes.error.includes("UNIQUE")) {
                console.log("   User exists. Logging in...");
                const loginRes = await post('/auth/login', { email: user.email, password: DEFAULT_PASSWORD });
                if (loginRes.user) {
                    userData = loginRes.user;
                } else {
                    console.error("   ❌ Login failed:", loginRes);
                    return;
                }
            } else {
                console.error("   ❌ Registration failed:", regRes.error);
                return;
            }
        } else {
            userData = regRes; // Assuming register returns user object
            // If register structure is different, we might need to adjust.
            // Based on seed.js: const userId = userResult.id;
            if (!userData.id && userData.user) userData = userData.user; // Handle potential wrapper
        }
    } catch (e) {
        console.error("   ❌ Auth Error:", e.message);
        return;
    }

    // Safety check for ID
    const userId = userData.User_ID || userData.id;
    if (!userId) {
        console.error("   ❌ Could not get User ID. Aborting for this user.", userData);
        return;
    }
    console.log(`   ✅ User ID: ${userId}`);

    // 2. CATEGORIES (Ensure defaults exist)
    // The previous seed_categories.js did this manually. Let's try to trigger it or add them if missing.
    // For now, let's assume valid default categories or create a few needed ones.
    const commonCategories = [
        { name: "Food", type: "Expense" },
        { name: "Travel", type: "Expense" },
        { name: "Salary", type: "Income" },
        { name: "Bills", type: "Expense" },
        { name: "Health", type: "Expense" },
        { name: "Shopping", type: "Expense" },
        { name: "Entertainment", type: "Expense" },
        { name: "Investment", type: "Income" },
        { name: "Pocket Money", type: "Income" },
        { name: "Freelance", type: "Income" }
    ];

    console.log("   Ensuring Categories...");
    // Fetch existing categories to avoid duplicates? The API might handle it or error.
    // We'll just try to create them and ignore errors.
    const userCategories = [];
    for (const cat of commonCategories) {
        const catRes = await post('/categories', {
            user_id: userId,
            category_name: cat.name,
            category_type: cat.type
        });
        if (catRes.category_id) {
            userCategories.push({ ...cat, id: catRes.category_id });
        } else {
            // If failed (likely duplicate), we need to fetch it to get the ID for transactions
            // Optimization: Get all categories once
        }
    }

    // Fetch all categories for reference
    const allCatsRes = await get(`/categories/${userId}`);
    const allCats = Array.isArray(allCatsRes) ? allCatsRes : [];

    const getCatId = (name) => {
        const cat = allCats.find(c => c.Category_Name === name);
        return cat ? cat.Category_ID : (allCats[0]?.Category_ID || 1);
    };

    // 3. ACCOUNTS
    console.log("   Creating Accounts...");
    const accountIds = [];
    for (const acc of user.accounts) {
        const accRes = await post('/accounts', {
            user_id: userId,
            account_name: acc.name,
            account_type: acc.type,
            balance: acc.balance
        });
        if (accRes.account_id || accRes.id) accountIds.push(accRes.account_id || accRes.id);
    }

    if (accountIds.length === 0) {
        console.log("   ⚠️ No accounts created (maybe duplicates?). Fetching existing...");
        const existAccs = await get(`/accounts/${userId}`); // Assuming this route exists
        if (Array.isArray(existAccs)) existAccs.forEach(a => accountIds.push(a.Account_ID));
    }

    // 4. TRANSACTIONS
    if (accountIds.length > 0) {
        console.log(`   Injecting ${user.transactions} Transactions...`);
        for (let i = 0; i < user.transactions; i++) {
            const isExpense = Math.random() > 0.3; // 70% expenses
            const type = isExpense ? 'Expense' : 'Income';

            // Pick random account and category
            const accId = accountIds[Math.floor(Math.random() * accountIds.length)];

            // Filter categories by type
            const typeCats = allCats.filter(c => c.Category_Type === type);
            const cat = typeCats.length > 0 ? typeCats[Math.floor(Math.random() * typeCats.length)] : allCats[0];

            const amount = isExpense
                ? Math.floor(Math.random() * 5000) + 50
                : Math.floor(Math.random() * 20000) + 5000;

            await post('/transactions', {
                user_id: userId,
                account_id: accId,
                category_id: cat?.Category_ID || 1,
                amount: amount,
                type: type,
                ref_type: 'Manual', // or 'Salary' occasionally
                description: `Auto-generated ${type} ${i + 1}`
            });
        }
    }

    // 5. SAVINGS
    if (user.savings && user.savings.length > 0) {
        console.log("   Setting Savings Goals...");
        for (const save of user.savings) {
            await post('/savings', {
                user_id: userId,
                goal_title: save.title,
                target_amount: save.target,
                current_amount: save.current,
                start_date: new Date().toISOString().split('T')[0],
                target_date: '2027-01-01' // Future date
            });
        }
    }

    // 6. EMI
    if (user.emi && accountIds.length > 0) {
        console.log("   Setting up EMI...");

        // Need a category for EMI (Expense)
        const emiCatId = getCatId("Bills") || getCatId("Loans") || 1;

        await post('/emi', {
            user_id: userId,
            account_id: accountIds[0],
            category_id: emiCatId,
            emi_title: user.emi.title,
            lender_name: "Bank of India", // Generic
            total_loan_amount: user.emi.total,
            interest_rate: 8.5,
            tenure_months: user.emi.tenure,
            emi_amount: user.emi.amount,
            emi_day: 5,
            start_date: new Date().toISOString().split('T')[0],
            end_date: '2040-01-01'
        });
    }

    // 7. BUDGETS
    if (user.budgets && user.budgets.length > 0) {
        console.log("   Setting Budgets...");
        for (const bud of user.budgets) {
            const catId = getCatId(bud.category);
            if (catId) {
                await post('/budget', {
                    user_id: userId,
                    category_id: catId,
                    budget_amount: bud.amount,
                    month_year: new Date().toISOString().slice(0, 7) // "YYYY-MM"
                });
            }
        }
    }

    console.log(`   ✅ Done for ${user.name}!`);
};

// Main Runner
const runSeeder = async () => {
    console.log("🌱 STARTING MULTI-USER SEED...");
    for (const user of USERS) {
        await seedUser(user);
    }
    console.log("\n✨ ALL DATA SEEDED SUCCESSFULLY! ✨");
};

runSeeder();
