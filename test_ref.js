const db = require('./backend/db');
(async () => {
    try {
        const [t] = await db.query("SELECT Amount, Description, Reference_Type FROM `TRANSACTION` WHERE User_ID=25 AND Transaction_Type='Expense'");
        t.forEach(r => console.log(r.Description, '|', r.Reference_Type));
        process.exit(0);
    } catch(err) {
        console.log(err);
        process.exit(1);
    }
})();
