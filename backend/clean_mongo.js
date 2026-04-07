const mongoose = require('mongoose');
const db = require('./db');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DELETED_IDS = [3, 4, 5, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30];
const MONGO_URI = 'mongodb://localhost:27017/fintrack_logs';

async function cleanMongo() {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
    console.log("Connected to MongoDB: fintrack_logs");

    // Get valid user IDs from MySQL
    const [validUsers] = await db.query('SELECT User_ID FROM USERS');
    const validIds = validUsers.map(u => u.User_ID);
    console.log("Valid MySQL User IDs:", validIds);

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("MongoDB collections:", collections.map(c => c.name));

    for (const col of collections) {
        const collection = mongoose.connection.db.collection(col.name);
        const beforeCount = await collection.countDocuments();

        // Delete by exact garbage IDs
        for (const id of DELETED_IDS) {
            await collection.deleteMany({ user_id: id });
        }

        // Delete any orphan user_ids not in valid MySQL list
        try {
            const distinctIds = await collection.distinct('user_id');
            for (const id of distinctIds) {
                if (id !== null && id !== undefined && !validIds.includes(id)) {
                    const res = await collection.deleteMany({ user_id: id });
                    if (res.deletedCount > 0) {
                        console.log(`  [${col.name}] Deleted ${res.deletedCount} orphan docs for user_id=${id}`);
                    }
                }
            }
        } catch(e) {}

        const afterCount = await collection.countDocuments();
        if (beforeCount !== afterCount) {
            console.log(`[${col.name}] ${beforeCount} -> ${afterCount} documents`);
        } else {
            console.log(`[${col.name}] ${afterCount} documents (no changes needed)`);
        }
    }

    // Final verification: show what user_ids remain in transactions
    try {
        const txCol = mongoose.connection.db.collection('transactions');
        const remaining = await txCol.distinct('user_id');
        console.log("\nRemaining user_ids in 'transactions':", remaining);
    } catch(e) {}

    console.log("\nDONE! MongoDB fully cleaned. Only valid users remain.");
    await mongoose.disconnect();
    process.exit(0);
}

cleanMongo().catch(e => { console.error("FATAL:", e); process.exit(1); });
