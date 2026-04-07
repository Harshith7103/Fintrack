const db = require('./db');
db.execute("UPDATE USERS SET role = 'USER' WHERE Email != 'admin123@gmail.com'").then(() => {
    console.log('Fixed rohan! Reverted all normal users to USER');
    process.exit(0);
}).catch(console.error);
