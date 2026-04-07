const { initMongoDB, MonthlyReport } = require('./mongodb');
const { syncProjectData } = require('./utils/syncHelper');
const db = require('./db');

(async () => {
    try {
        await initMongoDB();
        console.log('MongoDB Initialized. Starting sync...');
        const [users] = await db.query('SELECT User_ID FROM USERS');
        console.log(`Found ${users.length} users. Syncing...`);
        
        for (const u of users) {
             await syncProjectData(u.User_ID);
        }

        const count = await MonthlyReport.countDocuments({ 'budgets.0': { $exists: true } });
        console.log('USERS SYNCED WITH BUDGETS:', count);
        process.exit(0);
    } catch(err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();
