const db = require('./backend/db');

(async () => {
    try {
        await db.query(`
            ALTER TABLE USERS 
            MODIFY COLUMN Occupation VARCHAR(100) DEFAULT 'Student'
        `);
        console.log('✅ Occupation column changed from ENUM to VARCHAR(100) — any value now accepted.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();
