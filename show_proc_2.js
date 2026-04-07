const db = require('./backend/db');
db.query("SHOW CREATE PROCEDURE sp_get_user_financial_summary").then(([r]) => {
    console.log(r[0]['Create Procedure']);
}).catch(e => {
    console.error(e);
}).finally(() => process.exit());
