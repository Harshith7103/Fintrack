const { MongoClient } = require('mongodb');

(async () => {
    try {
        const client = new MongoClient('mongodb://127.0.0.1:27017');
        await client.connect();
        const db = client.db('fintrack_logs');
        const res = await db.collection('monthlyreports').deleteMany({ report_id: { $regex: '^rep_' } });
        console.log(`Deleted ${res.deletedCount} old stripped reports.`);
        await client.close();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
