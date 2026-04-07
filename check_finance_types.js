const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    for (const t of ['TRANSACTION', 'ACCOUNT', 'BUDGET_V2', 'BUDGET_EVENTS']) {
        const [r] = await c.query("DESCRIBE `" + t + "`");
        console.log(`\n--- ${t} ---`);
        r.filter(col => 
            col.Field.toLowerCase().includes('amount') || 
            col.Field.toLowerCase().includes('balance') || 
            col.Field.toLowerCase().includes('income')
        ).forEach(col => console.log(`${col.Field}: ${col.Type}`));
    }
    await c.end();
})();
