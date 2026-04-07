const db = require('./backend/db');
db.query("SHOW CREATE PROCEDURE sp_add_to_savings_goal").then(([r]) => {
    console.log(r[0]['Create Procedure']);
}).catch(e => {
    console.error(e);
}).finally(() => process.exit());
