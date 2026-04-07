const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'fintrack'
    });
    const [rows] = await connection.query("DESCRIBE `TRANSACTION`");
    console.log(JSON.stringify(rows));
    const [rowsBudget] = await connection.query("DESCRIBE `BUDGET_V2`");
    console.log(JSON.stringify(rowsBudget));
    const [rowsEvents] = await connection.query("DESCRIBE `BUDGET_EVENTS`");
    console.log(JSON.stringify(rowsEvents));
    await connection.end();
})();
