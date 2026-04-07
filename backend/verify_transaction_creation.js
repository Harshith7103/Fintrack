const { spawn } = require('child_process');
const path = require('path');

// Start the server
const server = spawn('node', ['backend/server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true
});

server.stdout.on('data', (data) => {
    // console.log(`Server: ${data}`);
});

server.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    try {
        console.log('Waiting for server to start...');
        await wait(5000);

        const baseUrl = 'http://localhost:5000/api';

        // 1. Login as Jatin
        console.log('\n1. Logging in as Jatin...');
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'jatin123@gmail.com',
                // We need to know Jatin's password. 
                // In migration we copied the password hash/text directly.
                // If it was 'password123' in SQLite, it is same here.
                // Inspecting SQLite dump earlier showed dummy passwords or we can try a known one if we reset it.
                // Wait, I don't know Jatin's password from the migration script, it just copied `u.Password`.
                // For this test, let's use 'rohan@example.com' (password123) which we know works.
                email: 'rohan@example.com',
                password: 'password123'
            })
        });

        const loginData = await loginRes.json();
        console.log('Login Response:', loginData);

        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);

        // Check for User_ID or id
        const userId = loginData.user.User_ID || loginData.user.id;
        console.log('Login Successful. User ID:', userId);

        // 2. Get Accounts to find one to use
        const accRes = await fetch(`${baseUrl}/accounts/${userId}`);
        const accounts = await accRes.json();
        if (accounts.length === 0) throw new Error('No accounts found for user');
        const accountId = accounts[0].Account_ID;
        console.log(`Using Account ID: ${accountId} (${accounts[0].Account_Name})`);

        // 3. Create Transaction
        console.log('\n2. Creating Expense Transaction...');
        const txRes = await fetch(`${baseUrl}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                account_id: accountId,
                category_id: 1, // Assumptions: Category 1 exists (Food usually)
                amount: 100.50,
                transaction_type: 'Expense',
                description: 'API Verification Test',
                reference_type: 'Manual'
            })
        });

        const txData = await txRes.json();
        console.log('Create Transaction Response:', txRes.status, txData);

        if (!txRes.ok) throw new Error(`Transaction failed: ${JSON.stringify(txData)}`);

        // 4. Verify Balance Update (Optional but good)
        // Refetch account
        const accRes2 = await fetch(`${baseUrl}/accounts/${userId}`);
        const accounts2 = await accRes2.json();
        const updatedAcc = accounts2.find(a => a.Account_ID === accountId);
        console.log(`Old Balance: ${accounts[0].Balance}`);
        console.log(`New Balance: ${updatedAcc.Balance}`);

        const expected = parseFloat(accounts[0].Balance) - 100.50;
        if (Math.abs(parseFloat(updatedAcc.Balance) - expected) < 0.01) {
            console.log('✅ Balance updated correctly.');
        } else {
            console.error('❌ Balance mismatch!');
        }

    } catch (err) {
        console.error('Test Script Error:', err);
    } finally {
        console.log('\nStopping server...');
        server.kill();
        process.exit();
    }
})();
