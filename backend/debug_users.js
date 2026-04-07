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

        const [rows] = await connection.execute('SELECT User_ID, Email, Password, Length(Password) as PassLen FROM USERS');
        console.log('Users in DB:', rows);

        await connection.end();
    } catch (err) {
        console.error(err);
    }
})();
