const db = require('./db');
const { TransactionMongo } = require('./mongodb');
const fs = require('fs');

async function purgeGarbageSafe() {
    let conn;
    try {
        fs.writeFileSync('log.txt', '');
        conn = await db.getConnection();
        await conn.query('SET FOREIGN_KEY_CHECKS=0;');
        
        const [users] = await conn.query('SELECT User_ID, Name, Email FROM USERS');
        const garbagePatterns = ['test', 'verify', 'incomeuser', 'perf', 'nomoney', 'super admin', 'dummy'];
        
        let deletedCount = 0;
        
        for (const u of users) {
            const nameLower = u.Name ? u.Name.toLowerCase() : '';
            const emailLower = u.Email ? u.Email.toLowerCase() : '';
            if (u.Email === 'admin123@gmail.com') continue;

            const isGarbage = garbagePatterns.some(pat => nameLower.includes(pat) || emailLower.includes(pat));
            if (isGarbage) {
                fs.appendFileSync('log.txt', `\nDELETING GARBAGE USER: ${u.Name} (${u.Email})\n`);
                
                const q = async (sql) => {
                    fs.appendFileSync('log.txt', `   -> Running: ${sql}\n`);
                    await conn.query(sql, [u.User_ID]);
                };
                
                await q('DELETE FROM ACCOUNT WHERE User_ID = ?');
                await q('DELETE FROM \`TRANSACTION\` WHERE User_ID = ?');
                await q('DELETE FROM CATEGORY WHERE User_ID = ?');
                await q('DELETE FROM EMI WHERE User_ID = ?');
                await q('DELETE FROM BUDGET WHERE User_ID = ?');
                await q('DELETE FROM FINANCIAL_GOAL WHERE User_ID = ?');
                await q('DELETE FROM USER_PHONES WHERE User_ID = ?');
                await q('DELETE FROM AUDIT_LOG WHERE Changed_By_User_ID = ?');
                try { await q('DELETE FROM NOTIFICATION WHERE User_ID = ?'); } catch(e){}
                await q('DELETE FROM USERS WHERE User_ID = ?');
                
                try { await TransactionMongo.deleteMany({ user_id: u.User_ID }); } catch(e){}
                
                deletedCount++;
            }
        }
        
        await conn.query('SET FOREIGN_KEY_CHECKS=1;');
        conn.release();
        fs.appendFileSync('log.txt', `Success!`);
        process.exit(0);
    } catch(e) {
        if(conn) {
             try { await conn.query('SET FOREIGN_KEY_CHECKS=1;'); conn.release(); } catch(err){}
        }
        fs.appendFileSync('log.txt', `ERROR: ${e.message}`);
        console.error("ERROR:", e); 
        process.exit(1);
    }
}
purgeGarbageSafe();
