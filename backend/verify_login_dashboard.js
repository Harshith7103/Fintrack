const { spawn } = require('child_process');
const path = require('path');

// Start the server
const server = spawn('node', ['backend/server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true
});

let serverOutput = '';
server.stdout.on('data', (data) => {
    // console.log(`Server: ${data}`); // Optional logging
});

server.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    try {
        console.log('Waiting for server to start...');
        await wait(5000); // Wait for server to boot

        const baseUrl = 'http://localhost:5000/api';

        // 1. Test Login
        console.log('\nTesting Login...');
        try {
            const loginRes = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'rohan@example.com',
                    password: 'password123'
                })
            });

            const loginData = await loginRes.json();
            console.log('Login Status:', loginRes.status);

            if (!loginRes.ok) {
                console.error('Login Failed:', loginData);
            } else {
                console.log('Login Successful:', loginData.message);
            }

        } catch (error) {
            console.error('Login Request Error:', error.message);
        }

        // 2. Test Dashboard for User 1
        console.log('\nTesting Dashboard for User 1...');
        try {
            const dashboardRes = await fetch(`${baseUrl}/dashboard/1`);
            const dashboardData = await dashboardRes.json();

            console.log('Dashboard Status:', dashboardRes.status);

            if (!dashboardRes.ok) {
                console.error('Dashboard Failed:', dashboardData);
            } else {
                console.log('Dashboard Data received successfully.');
                console.log('Total Balance:', dashboardData.total_balance);
                console.log('Recent Transactions:', dashboardData.recent_transactions?.length);
            }
        } catch (error) {
            console.error('Dashboard Request Error:', error.message);
        }

    } catch (err) {
        console.error('Test Script Error:', err);
    } finally {
        console.log('\nStopping server...');
        server.kill();
        process.exit();
    }
})();
