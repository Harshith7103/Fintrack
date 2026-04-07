const mongoose = require('mongoose');

async function cleanup() {
    try {
        await mongoose.connect('mongodb://localhost:27017');
        console.log('Connected to MongoDB.');

        const db = mongoose.connection.db;
        const admin = new mongoose.mongo.Admin(db);
        const { databases } = await admin.listDatabases();

        const dbsToDrop = ['myDatabase', 'test', 'practice', 'practice 1']; // Common test names from screenshot

        for (const d of databases) {
            if (dbsToDrop.includes(d.name)) {
                console.log(`Dropping test database: ${d.name}...`);
                await mongoose.connection.useDb(d.name).dropDatabase();
            }
        }

        console.log('✅ CLEANUP COMPLETE: All non-project test databases removed from MongoDB Compass!');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup Error:', err.message);
        process.exit(1);
    }
}

cleanup();
