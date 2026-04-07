const { initMongoDB, MonthlyReport } = require('./backend/mongodb');
const { syncProjectData } = require('./backend/utils/syncHelper');

(async () => {
    try {
        await initMongoDB();
        console.log('MongoDB Initialized. Syncing user 25...');
        await syncProjectData(25);
        const doc = await MonthlyReport.findOne({ user_id: 25 }, { budgets: 1 });
        console.log('Result in MongoDB:', JSON.stringify(doc));
    } catch(err) {
        console.error('Test error:', err);
    } finally {
        process.exit();
    }
})();
