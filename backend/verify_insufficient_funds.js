const http = require('http');

function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: '127.0.0.1',
            port: 5005,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: JSON.parse(responseBody || '{}')
                });
            });
        });

        req.on('error', (error) => reject(error));
        if (data) req.write(data);
        req.end();
    });
}

async function verifyInsufficientFunds() {
    console.log("🚀 Verifying Insufficient Funds Check...");

    try {
        // 1. Create a user with 0 balance
        const uniqueId = Date.now();
        const user = {
            name: `NoMoney${uniqueId}`,
            email: `nomoney${uniqueId}@example.com`,
            phone: `${uniqueId}`.slice(0, 10).padEnd(10, '0'),
            password: 'password123',
            occupation: 'Student',
            monthly_income: 0 // Start with 0
        };

        const regRes = await makeRequest('/auth/register', 'POST', user);
        if (regRes.status !== 200) {
            console.error("Registration failed:", regRes.body);
            return;
        }
        const userId = regRes.body.id;
        console.log(`✅ User registered with ID: ${userId}`);

        // 2. Get Account ID (Cash Wallet created by default)
        const accRes = await makeRequest(`/accounts/${userId}`, 'GET');
        const accountId = accRes.body[0].Account_ID;
        console.log(`✅ Default Account ID: ${accountId} (Balance: ${accRes.body[0].Balance})`);

        // 3. Try to spend 100 (Should FAIL)
        console.log("Attempting expense of 100 with 0 balance...");
        const failRes = await makeRequest('/transactions', 'POST', {
            user_id: userId,
            account_id: accountId,
            category_id: 1, // 'Salary' or any valid ID, assume 1 exists
            amount: 100,
            transaction_type: 'Expense',
            description: 'This should fail'
        });

        if (failRes.status === 400 && failRes.body.error === 'Insufficient funds') {
            console.log("✅ PASSED: Transaction rejected due to insufficient funds.");
        } else {
            console.error("❌ FAILED: Transaction was NOT rejected correctly.", failRes.status, failRes.body);
        }

        // 4. Add Income 500
        console.log("\nAdding income of 500...");
        await makeRequest('/transactions', 'POST', {
            user_id: userId,
            account_id: accountId,
            category_id: 1,
            amount: 500,
            transaction_type: 'Income',
            description: 'Salary'
        });

        // 5. Try to spend 600 (Should FAIL)
        console.log("Attempting expense of 600 with 500 balance...");
        const failRes2 = await makeRequest('/transactions', 'POST', {
            user_id: userId,
            account_id: accountId,
            category_id: 1,
            amount: 600,
            transaction_type: 'Expense',
            description: 'This should also fail'
        });

        if (failRes2.status === 400 && failRes2.body.error === 'Insufficient funds') {
            console.log("✅ PASSED: Transaction rejected (amount > balance).");
        } else {
            console.error("❌ FAILED: Transaction was NOT rejected correctly.", failRes2.status, failRes2.body);
        }

    } catch (err) {
        console.error("Verification Error:", err.message);
    }
}

verifyInsufficientFunds();
