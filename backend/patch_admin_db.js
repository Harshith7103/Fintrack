const db = require('./db');

async function patchDB() {
    try {
        console.log("Applying DB patches for Admin Module...");
        
        // 1. Add role to USERS table if not exists
        await db.query(`
            ALTER TABLE USERS 
            ADD COLUMN role VARCHAR(10) DEFAULT 'USER'
        `).catch(err => {
            if(err.code === 'ER_DUP_FIELDNAME') {
                console.log("role column already exists.");
            } else {
                throw err;
            }
        });

        // 2. Set an existing user as ADMIN (for demo purposes)
        // Let's set the first user as ADMIN
        await db.query(`UPDATE USERS SET role = 'ADMIN' LIMIT 1`);
        
        console.log("Admin patches applied successfully.");
    } catch (error) {
        console.error("Error applying patches:", error);
    } finally {
        process.exit();
    }
}

patchDB();
