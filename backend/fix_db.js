const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Check schema and add Password column if it doesn't exist
db.serialize(() => {
    // Check if Password column exists
    db.all("PRAGMA table_info(USERS)", [], (err, columns) => {
        if (err) {
            console.error('Error checking schema:', err);
            return;
        }

        const hasPassword = columns.some(col => col.name === 'Password');

        if (!hasPassword) {
            console.log('⚠️  Password column missing. Adding it now...');
            db.run('ALTER TABLE USERS ADD COLUMN Password TEXT', (err) => {
                if (err) {
                    console.error('Error adding Password column:', err);
                    return;
                }
                console.log('✅ Password column added!');
                insertDemoUser();
            });
        } else {
            console.log('✅ Password column exists!');
            insertDemoUser();
        }
    });
});

function insertDemoUser() {
    // Check if demo user exists
    db.get('SELECT * FROM USERS WHERE Email = ?', ['john@example.com'], (err, user) => {
        if (err) {
            console.error('Error:', err);
            db.close();
            return;
        }

        if (user) {
            // Update existing user with password
            const hashedPassword = hashPassword('password123');
            db.run('UPDATE USERS SET Password = ? WHERE Email = ?',
                [hashedPassword, 'john@example.com'],
                (err) => {
                    if (err) {
                        console.error('Error updating user:', err);
                    } else {
                        console.log('✅ Demo user password updated!');
                        console.log('\n📋 Login Credentials:');
                        console.log('   Email: john@example.com');
                        console.log('   Password: password123\n');
                    }
                    db.close();
                }
            );
        } else {
            // Create new demo user
            const hashedPassword = hashPassword('password123');
            const sql = `INSERT INTO USERS (Name, Email, Phone_No, Address, Occupation, Monthly_Income, Password) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;

            db.run(sql, [
                'Rahul Sharma',
                'john@example.com',
                '9876543210',
                'Koramangala, Bangalore, Karnataka',
                'Software Engineer',
                85000,
                hashedPassword
            ], function (err) {
                if (err) {
                    console.error('Error creating user:', err);
                } else {
                    console.log('✅ Demo user created!');
                    console.log('\n📋 Login Credentials:');
                    console.log('   Email: john@example.com');
                    console.log('   Password: password123\n');
                }
                db.close();
            });
        }
    });
}
