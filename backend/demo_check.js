const http = require('http');

console.log("\n====== FINTRACK LIVE SYSTEM STATUS ======");
const get = (path) => {
    return new Promise((resolve) => {
        http.get('http://localhost:5000/api' + path, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
    });
};

const runStatusCheck = async () => {
    try {
        // 1. Check User
        const users = await get('/users');
        if (users.length > 0) {
            const u = users[0];
            console.log(`\n👤 User: ${u.Name} (${u.Occupation})`);
            console.log(`   Email: ${u.Email}`);

            // 2. Check Accounts
            const accounts = await get(`/accounts/${u.User_ID}`);
            console.log("\n🏦 Accounts:");
            accounts.forEach(acc => {
                console.log(`   - [${acc.Account_Type}] ${acc.Account_Name}: $${acc.Balance.toLocaleString()}`);
            });

            // 3. Check Recent Transactions
            const txs = await get(`/transactions/${u.User_ID}`);
            console.log(`\n💸 Recent Transactions (${txs.length} total):`);
            txs.slice(0, 5).forEach(tx => {
                const symbol = tx.Transaction_Type === 'Expense' ? '-' : '+';
                console.log(`   ${tx.Transaction_DateTime.split('T')[0]} | ${symbol}$${tx.Amount} | ${tx.Reference_Type}`);
            });

            console.log("\n✅ SYSTEM IS ONLINE AND FUNCTIONAL");
        } else {
            console.log("\n⚠️ No users found. Did seed run?");
        }
    } catch (e) {
        console.error("❌ Connection Failed:", e.message);
    }
};

runStatusCheck();
