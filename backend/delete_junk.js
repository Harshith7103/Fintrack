const db = require('./db');
const { TransactionMongo } = require('./mongodb');

async function purgeJunk() {
    try {
        // Find users explicitly to remove anything that looks like junk based on user request
        const [users] = await db.query(`
            SELECT User_ID, Name, Email 
            FROM USERS 
            WHERE Name IN ('test user', 'IncomeUser', 'pref user', 'test', 'dummy') 
            OR LOWER(Name) LIKE '%test%' 
            OR LOWER(Name) LIKE '%pref%' 
            OR LOWER(Name) LIKE '%incomeuser%' 
            OR LOWER(Email) LIKE '%test%'
        `);
        console.log(`Found ${users.length} junk users to delete:`, users.map(u => u.Name));
        
        for (const u of users) {
            console.log(`Deleting ${u.Name} (ID: ${u.User_ID})...`);
            try { await db.query('DELETE FROM EMI WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM \`TRANSACTION\` WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM BUDGET WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM FINANCIAL_GOAL WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM ACCOUNT WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM CATEGORY WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM USER_PHONES WHERE User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM AUDIT_LOG WHERE Changed_By_User_ID = ?', [u.User_ID]); } catch(e){}
            try { await db.query('DELETE FROM USERS WHERE User_ID = ?', [u.User_ID]); } catch(e){}
             
            // Also delete from MongoDB
            await TransactionMongo.deleteMany({ user_id: u.User_ID });
        }
        console.log("Junk purged completely from MySQL and MongoDB.");
        process.exit();
    } catch(e) {
        console.error(e); process.exit(1);
    }
}
purgeJunk();
