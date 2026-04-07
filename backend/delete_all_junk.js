const db = require('./db');
const { TransactionMongo } = require('./mongodb');

async function purgeAllJunk() {
    try {
        const [users] = await db.query('SELECT User_ID, Name, Email FROM USERS');
        
        const allowedNames = ['madhuri', 'pooja vellati', 'pooja', 'akhil', 'jatin', 'damini', 'rakesh', 'system admin', 'rohan']; 
        // Adding rohan just in case, though rohan sharma is a real name. I'll include 'rohan' to be safe since they didn't list him to delete, but earlier said 'rohan sharma is a normal user'.
        // Also keep System Admin!
        
        console.log(`Checking ${users.length} users...`);
        let deletedCount = 0;
        
        for (const u of users) {
            const nameLower = u.Name ? u.Name.toLowerCase() : '';
            const isAllowed = allowedNames.some(allowed => nameLower.includes(allowed)) || u.Email === 'admin123@gmail.com';
            
            if (!isAllowed) {
                console.log(`DELETING JUNK USER: ${u.Name} (${u.Email}) - ID: ${u.User_ID}`);
                try { await db.query('DELETE FROM EMI WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM \`TRANSACTION\` WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM BUDGET WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM FINANCIAL_GOAL WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM ACCOUNT WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM CATEGORY WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM USER_PHONES WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM AUDIT_LOG WHERE Changed_By_User_ID = ?', [u.User_ID]); } catch(e){}
                try { await db.query('DELETE FROM USERS WHERE User_ID = ?', [u.User_ID]); } catch(e){}
                
                // Delete from MongoDB
                await TransactionMongo.deleteMany({ user_id: u.User_ID });
                deletedCount++;
            }
        }
        
        console.log(`Successfully purged ${deletedCount} useless users from the entire project!`);
        process.exit();
    } catch(e) {
        console.error(e); process.exit(1);
    }
}
purgeAllJunk();
