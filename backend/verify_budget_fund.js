const http = require('http');
const db = require('./db');

function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: '127.0.0.1',
            port: 5006,
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

async function verifyBudgetFund() {
    console.log("🚀 Verifying Budget Fund Feature...");

    let connection;
    try {
        // 1. Setup Data directly in DB to avoid dependencies
        connection = await db.getConnection();

        // Create User
        const uniqueId = Date.now();
        const [userRes] = await connection.execute(
            `INSERT INTO USERS (Name, Email, Phone_No, Password, Occupation, Monthly_Income) 
             VALUES (?, ?, ?, 'pass', 'Student', 50000)`,
            [`TestUser${uniqueId}`, `test${uniqueId}@test.com`, `${uniqueId}`.slice(0, 10)]
        );
        const userId = userRes.insertId;
        console.log(`✅ User Created: ${userId}`);

        // Create Account
        const [accRes] = await connection.execute(
            `INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) 
             VALUES (?, 'Test Bank', 'Bank', 50000)`,
            [userId]
        );
        const accountId = accRes.insertId;
        console.log(`✅ Account Created: ${accountId}`);

        // 2. Test API: Create Fund
        console.log("Creating Trip Fund (10000)...");
        const fundRes = await makeRequest('/budget-funds/create', 'POST', {
            userId: userId,
            fundName: 'Goa Trip',
            description: 'Summer Vacation',
            totalAmount: 10000,
            sourceAccountId: accountId
        });

        if (fundRes.status !== 200) {
            console.error("❌ Fund Creation Failed", fundRes.body);
            return;
        }
        const fundId = fundRes.body.fundId;
        console.log(`✅ Fund Created: ${fundId} (Balance deducted from Main Account)`);

        // 3. Test API: Add Event
        console.log("Adding Event: Food (4000)...");
        const eventRes = await makeRequest('/budget-funds/event', 'POST', {
            fundId: fundId,
            eventName: 'Food',
            allocatedAmount: 4000
        });
        if (eventRes.status !== 200) {
            console.error("❌ Event Creation Failed", eventRes.body);
            return;
        }
        console.log("✅ Event Added");

        // 4. Test API: Record Expense
        // Get Event ID first (from DB for speed)
        const [events] = await connection.execute('SELECT Event_ID FROM BUDGET_EVENT WHERE Fund_ID = ?', [fundId]);
        const eventId = events[0].Event_ID;

        console.log(`Recording Expense (200) on Event...`);
        const expRes = await makeRequest('/budget-funds/expense', 'POST', {
            fundId: fundId,
            eventId: eventId,
            amount: 200,
            description: 'Lunch'
        });

        if (expRes.status === 200) {
            console.log("✅ Expense Recorded Successfully");
        } else {
            console.error("❌ Expense Failed", expRes.body);
        }

        console.log("✨ Verification Complete!");

    } catch (err) {
        console.error("Verification Error:", err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

verifyBudgetFund();
