const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    // 1. Register the user via the API (Simulating the Frontend)
    console.log('Simulating User Registration for "damini123@gmail.com"...');

    try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Damini User',
                email: 'damini123@gmail.com',
                phone: '9998887776',
                address: 'Delhi, India',
                employment_status: 'Employed',
                occupation: 'Manager',
                monthly_income: 50000,
                password: 'password123456'
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Registration Successful via API:', data);
        } else {
            // If already exists, that's fine too, we just want to verify it's in the DB
            console.log('ℹ️ Registration Response:', data);
        }

    } catch (err) {
        console.error('❌ API Request Failed:', err.message);
        // We continue to check the DB anyway, in case it was added manually by user
    }

    console.log('\n---------------------------------------------------');
    console.log('Connecting to Database `fintrack_final` to verify...');
    console.log('---------------------------------------------------\n');

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME // Should be fintrack_final
        });

        const [rows] = await connection.execute(
            'SELECT User_ID, Name, Email, Phone_No, Occupation, Monthly_Income FROM USERS WHERE Email = ?',
            ['damini123@gmail.com']
        );

        if (rows.length > 0) {
            console.log('✅ RECORD FOUND IN DATABASE:');
            console.table(rows[0]);
            console.log('\nThis confirms that data entered is correctly saved to the `fintrack_final` database.');
        } else {
            console.log('❌ Record NOT found in database. Something isn\'t connected right.');
        }

    } catch (err) {
        console.error('Database Error:', err);
    } finally {
        if (connection) await connection.end();
    }
})();
