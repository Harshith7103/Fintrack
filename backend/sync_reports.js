const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fintrack_logs';

async function syncAll() {
    let connection;
    try {
        console.log('Connecting to MySQL & MongoDB...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        await mongoose.connect(MONGO_URI);

        const { MonthlyReport } = require('./mongodb');

        // Wipe ANY placeholder data - We are doing REAL sync now!
        await MonthlyReport.deleteMany({});

        // 1. Get ALL Users
        const [users] = await connection.query('SELECT User_ID, Name FROM USERS');
        console.log(`Syncing ${users.length} users...`);

        const { syncProjectData } = require('./utils/syncHelper');
        const currentMonth = new Date().toISOString().substring(0, 7);

        for (const user of users) {
             console.log(`Syncing Real Data for: ${user.Name} (ID: ${user.User_ID})...`);
             // Call the centralized sync logic for the current month
             // This ensures even new users with 0 transactions get a report
             await syncProjectData(user.User_ID, currentMonth);
        }

        console.log('✅ REAL-TIME SYNC COMPLETE: Every user in MySQL has a corresponding MongoDB Bank Statement report for ' + currentMonth + '!');
        process.exit(0);

    } catch (err) {
        console.error('Sync Error:', err.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

syncAll();
