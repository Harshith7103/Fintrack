const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await connection.query('SELECT User_ID, Name FROM USERS');
        console.log('--- USERS LIST ---');
        rows.forEach(user => {
            console.log(`ID: ${user.User_ID}, Name: ${user.Name}`);
        });
        await connection.end();
    } catch (err) {
        console.error('Error fetching users:', err.message);
    }
})();
