const mongoose = require('mongoose');
const { Notification } = require('./backend/mongodb');

async function checkNotifications() {
    try {
        await mongoose.connect('mongodb://localhost:27017/fintrack_logs');
        console.log('Connected to MongoDB');
        const notifs = await Notification.find().sort({ timestamp: -1 }).limit(5);
        console.log('Last 5 Notifications:', JSON.stringify(notifs, null, 2));
        process.exit();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkNotifications();
