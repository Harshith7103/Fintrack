const db = require('./db');
const { TransactionMongo } = require('./mongodb');

async function purgeGarbage() {
    let conn;
    try {
        // Using pool.getConnection to ensure session settings (like FOREIGN_KEY_CHECKS=0) stay on the same connection.
        conn = await db.getConnection();
        await conn.query('SET FOREIGN_KEY_CHECKS=0;');
        
        const [users] = await conn.query('SELECT col.*, col.User_ID FROM USERS col');
        
        // Exact strings that represent the fake/system users the user wants removed
        const garbagePatterns = ['test', 'verify', 'incomeuser', 'perf', 'nomoney', 'super admin', 'dummy'];
        
        let deletedCount = 0;
        
        for (const u of users) {
            const nameLower = u.Name ? u.Name.toLowerCase() : '';
            const emailLower = u.Email ? u.Email.toLowerCase() : '';
            
            const isGarbage = garbagePatterns.some(pat => nameLower.includes(pat) || emailLower.includes(pat));
            
            // Protect real System Admin
            if (u.Email === 'admin123@gmail.com') continue;

            if (isGarbage) {
                console.log(`[FORCE PURGE] DELETING GARBAGE USER: ${u.Name} (${u.Email})`);
                
                // Cascade delete forcefully since FK checks are disabled.
                await conn.query('DELETE FROM EMI WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM \`TRANSACTION\` WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM BUDGET WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM FINANCIAL_GOAL WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM ACCOUNT WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM CATEGORY WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM USER_PHONES WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM AUDIT_LOG WHERE Changed_By_User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM NOTIFICATION WHERE User_ID = ?', [u.User_ID]); 
                await conn.query('DELETE FROM USERS WHERE User_ID = ?', [u.User_ID]); 
                
                try { await TransactionMongo.deleteMany({ user_id: u.User_ID }); } catch(e){}
                
                deletedCount++;
            }
        }
        
        await conn.query('SET FOREIGN_KEY_CHECKS=1;');
        conn.release();
        
        console.log(`Successfully FORCE PURGED ${deletedCount} fake/spam users from MySQL and MongoDB!`);
        process.exit(0);
    } catch(e) {
        if(conn) {
             try { await conn.query('SET FOREIGN_KEY_CHECKS=1;'); conn.release(); } catch(err){}
        }
        console.error("FATAL ERROR:", e); 
        process.exit(1);
    }
}
purgeGarbage();
