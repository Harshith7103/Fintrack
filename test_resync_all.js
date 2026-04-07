const mongoose = require('mongoose');
const db = require('./backend/db');
const { syncProjectData } = require('./backend/utils/syncHelper');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/fintrack_logs');
        const [users] = await db.query('SELECT User_ID FROM USERS');
        for (const user of users) {
             await syncProjectData(user.User_ID);
        }
        console.log('SYNCED ALL USERS VIA UPDATED HELPER');
        process.exit();
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
