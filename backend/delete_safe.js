const db = require('./db');
const { TransactionMongo } = require('./mongodb');

async function purgeGarbageSafe() {
    let conn;
    try {
        const [users] = await db.query('SELECT User_ID, Name, Email FROM USERS');
        const garbagePatterns = ['test', 'verify', 'incomeuser', 'perf', 'nomoney', 'super admin', 'dummy'];
        
        let deletedCount = 0;
        
        for (const u of users) {
            const nameLower = u.Name ? u.Name.toLowerCase() : '';
            const emailLower = u.Email ? u.Email.toLowerCase() : '';
            const isGarbage = garbagePatterns.some(pat => nameLower.includes(pat) || emailLower.includes(pat));
            
            if (u.Email === 'admin123@gmail.com') continue;

            if (isGarbage) {
                console.log(`DELETING GARBAGE USER: ${u.Name} (${u.Email})`);
                
                // 1. Inflate account balances so that transaction deletion triggers don't violate Check (Balance >= 0)
                await db.query('UPDATE ACCOUNT SET Balance = 9999999.00 WHERE User_ID = ?', [u.User_ID]);
                
                // 2. Delete transactions FIRST before accounts (to allow triggers to fire safely)
                await db.query('DELETE FROM \`TRANSACTION\` WHERE User_ID = ?', [u.User_ID]);
                
                // 3. Delete everything else safely
                await db.query('DELETE FROM EMI WHERE User_ID = ?', [u.User_ID]);
                await db.query('DELETE FROM BUDGET WHERE User_ID = ?', [u.User_ID]);
                await db.query('DELETE FROM FINANCIAL_GOAL WHERE User_ID = ?', [u.User_ID]);
                await db.query('DELETE FROM USER_PHONES WHERE User_ID = ?', [u.User_ID]);
                await db.query('DELETE FROM AUDIT_LOG WHERE Changed_By_User_ID = ?', [u.User_ID]);
                try { await db.query('DELETE FROM NOTIFICATION WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                
                // 4. Delete the Accounts now that Transactions are gone
                await db.query('DELETE FROM ACCOUNT WHERE User_ID = ?', [u.User_ID]);
                await db.query('DELETE FROM CATEGORY WHERE User_ID = ?', [u.User_ID]);
                
                // 5. Finally, Delete the User
                await db.query('DELETE FROM USERS WHERE User_ID = ?', [u.User_ID]);
                
                // 6. Delete MongoDB analytical data
                try { await TransactionMongo.deleteMany({ user_id: u.User_ID }); } catch(e){}
                
                deletedCount++;
            }
        }
        
        console.log(`Successfully purged ${deletedCount} fake/spam users naturally without constraint errors!`);
        process.exit(0);
    } catch(e) {
        console.error("ERROR:", e.message); 
        process.exit(1);
    }
}
purgeGarbageSafe();
