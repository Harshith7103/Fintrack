const db = require('./backend/db');
(async () => {
    try {
        const [t] = await db.query("SELECT Amount, Description FROM `TRANSACTION` WHERE User_ID=25 AND Transaction_Type='Expense'");
        let sum = 0;
        t.forEach(r => {
            sum += parseFloat(r.Amount);
            console.log(r.Description + ' = ' + r.Amount);
        });
        console.log('TOTAL:', sum);
        process.exit(0);
    } catch(err) {
        console.log(err);
        process.exit(1);
    }
})();
