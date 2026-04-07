const db = require('./backend/db');

(async () => {
    try {
        const month = new Date().toISOString().substring(0, 7);
        const [txs] = await db.query('SELECT Amount, Transaction_Type, Description FROM `TRANSACTION` WHERE User_ID = 25 AND DATE_FORMAT(Transaction_DateTime, "%Y-%m") = ?', [month]);
        
        let inc = 0, exp = 0;
        txs.forEach(t => {
            if (t.Transaction_Type === 'Income') inc += parseFloat(t.Amount);
            else exp += parseFloat(t.Amount);
        });
        
        console.log('Income:', inc, 'Expense:', exp, 'Net:', inc - exp);
        console.log('Top Expenses:');
        console.log(txs.filter(t => t.Transaction_Type === 'Expense').sort((a,b) => parseFloat(b.Amount) - parseFloat(a.Amount)).slice(0, 5));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
