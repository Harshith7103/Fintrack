const { initMongoDB } = require('./mongodb');
const { syncAllSqlTransactionsToMongo } = require('./utils/syncHelper');

async function syncNow() {
    await initMongoDB();
    const res = await syncAllSqlTransactionsToMongo();
    console.log("✅ Sync Complete:", res);
    process.exit(0);
}

syncNow();
