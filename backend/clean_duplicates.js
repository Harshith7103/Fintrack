const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { MonthlyReport } = require('./mongodb');

async function clean() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fintrack_logs');
        const res = await MonthlyReport.deleteMany({ report_id: { $regex: /^rep_/ } });
        console.log(`Successfully removed ${res.deletedCount} duplicate/old report documents.`);
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
clean();
