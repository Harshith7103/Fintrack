const http = require('http');

function makeRequest(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const start = process.hrtime();
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: '127.0.0.1',
            port: 5004,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`; // Though auth.js doesn't seem to use JWT yet, just user ID
        }

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                const end = process.hrtime(start);
                const duration = (end[0] * 1000 + end[1] / 1e6).toFixed(2);
                resolve({
                    status: res.statusCode,
                    body: JSON.parse(responseBody || '{}'),
                    duration: parseFloat(duration)
                });
            });
        });

        req.on('error', (error) => reject(error));
        if (data) req.write(data);
        req.end();
    });
}

async function runBenchmark() {
    console.log("🚀 Starting Performance Benchmark...");

    // 1. Register User (to ensure we have valid credentials)
    const uniqueId = Date.now();
    const user = {
        name: `PerfUser${uniqueId}`,
        email: `perf${uniqueId}@example.com`,
        phone: `${uniqueId}`.slice(0, 10).padEnd(10, '0'),
        password: 'password123',
        monthly_income: 50000
    };

    console.log(`\n1. registering user...`);
    // Try port 5000 first (main server)
    let port = 5000;

    // Helper to switch port if needed
    const request = (p, m, b) => {
        // Update port in makeRequest? No, let's just hardcode 5000 for now.
        return makeRequest(p, m, b);
    };

    try {
        const regRes = await makeRequest('/auth/register', 'POST', user);
        if (regRes.status !== 200) {
            console.error("Registration failed:", regRes.body);
            process.exit(1);
        }
        console.log(`✅ Registration took ${regRes.duration}ms`);
        const userId = regRes.body.id;

        // 2. Login
        console.log(`\n2. Benchmarking Login...`);
        const loginRes = await makeRequest('/auth/login', 'POST', {
            email: user.email,
            password: user.password
        });
        console.log(`✅ Login took ${loginRes.duration}ms`);

        // 3. Dashboard Load
        console.log(`\n3. Benchmarking Dashboard Data Fetch...`);
        const dashRes = await makeRequest(`/dashboard/${userId}`, 'GET');
        console.log(`✅ Dashboard Load took ${dashRes.duration}ms`);

        if (dashRes.duration > 200) {
            console.warn(`⚠️ Dashboard is SLOW! (${dashRes.duration}ms)`);
        } else {
            console.log(`✨ Dashboard is fast.`);
        }

    } catch (err) {
        console.error("Benchmark Error:", err.message);
    }
}

runBenchmark();
