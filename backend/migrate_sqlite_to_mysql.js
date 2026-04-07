const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const sqlitePath = path.join(__dirname, 'fintrack.db');
const dbSqlite = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY);

(async () => {
    let connection;
    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // 0. Drop Triggers to prevent double-counting balances during history migration
        console.log('Temporarily dropping triggers...');
        await connection.query('DROP TRIGGER IF EXISTS trg_update_balance_after_transaction');
        await connection.query('DROP TRIGGER IF EXISTS trg_update_summaries_after_transaction');

        console.log('Reading from SQLite...');

        // Helper to get SQLite data as Promise
        const getSqliteData = (query) => {
            return new Promise((resolve, reject) => {
                dbSqlite.all(query, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        // 1. Migrate USERS
        // We need to avoid duplicates. We'll skip if Email exists.
        console.log('\nMigrating USERS...');
        const users = await getSqliteData("SELECT * FROM USERS");
        for (const u of users) {
            // Check if exists
            const [exist] = await connection.execute('SELECT User_ID FROM USERS WHERE Email = ?', [u.Email]);
            if (exist.length === 0) {
                // Map Occupation to valid ENUM
                let occupation = u.Occupation || 'Other';
                const validOccupations = ['Student', 'Software Engineer', 'Employee', 'Business', 'Self-Employed', 'Unemployed', 'Retired', 'Other', 'Homemaker'];
                const occupationMap = {
                    'Freelancer': 'Self-Employed',
                    'Business Owner': 'Business',
                    'Homemaker': 'Homemaker', // Now valid
                    'Engineer': 'Employee',
                    '': 'Other'
                };

                if (occupationMap[occupation]) {
                    occupation = occupationMap[occupation];
                } else if (!validOccupations.includes(occupation)) {
                    console.log(`  Mapping unknown occupation '${occupation}' to 'Other'`);
                    occupation = 'Other';
                }

                // Handle Phone Number Uniqueness
                let phone = u.Phone_No;
                const [phoneExist] = await connection.execute('SELECT User_ID FROM USERS WHERE Phone_No = ?', [phone]);
                if (phoneExist.length > 0) {
                    // Generate a random unique phone if duplicate found
                    phone = '9' + Math.floor(Math.random() * 900000000).toString().padStart(9, '0');
                    console.log(`  Duplicate Phone for ${u.Name}, changed to ${phone}`);
                }

                await connection.execute(
                    'INSERT INTO USERS (Name, Email, Phone_No, Address, Occupation, Monthly_Income, Password) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [u.Name, u.Email, phone, u.Address, occupation, u.Monthly_Income || 0, u.Password]
                );
                console.log(`  Migrated User: ${u.Name}`);
            } else {
                console.log(`  Skipped User: ${u.Name} (Already exists)`);
            }
        }

        // Map old User IDs to New User IDs (needed for FKs)
        const [allMysqlUsers] = await connection.execute('SELECT User_ID, Email FROM USERS');
        const userMap = {}; // Email -> NewID
        allMysqlUsers.forEach(u => userMap[u.Email] = u.User_ID);


        // 2. Migrate ACCOUNTS
        console.log('\nMigrating ACCOUNTS...');
        const accounts = await getSqliteData("SELECT * FROM ACCOUNT");
        const oldUserMap = {};
        for (const u of users) {
            oldUserMap[u.User_ID] = u.Email;
        }

        const accountMap = {}; // Old_Account_ID -> New_Account_ID

        for (const acc of accounts) {
            const userEmail = oldUserMap[acc.User_ID];
            if (!userEmail) continue;
            const newUserId = userMap[userEmail];
            if (!newUserId) continue;

            const [exist] = await connection.execute(
                'SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? AND Account_Name = ?',
                [newUserId, acc.Account_Name]
            );

            if (exist.length === 0) {
                const [res] = await connection.execute(
                    'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)',
                    [newUserId, acc.Account_Name, acc.Account_Type, acc.Balance]
                );
                accountMap[acc.Account_ID] = res.insertId;
                console.log(`  Migrated Account: ${acc.Account_Name} for ${userEmail}`);
            } else {
                accountMap[acc.Account_ID] = exist[0].Account_ID;
            }
        }

        // 3. Migrate CATEGORIES
        console.log('\nMigrating CATEGORIES...');
        const categories = await getSqliteData("SELECT * FROM CATEGORY");
        const categoryMap = {}; // Old_ID -> New_ID

        for (const cat of categories) {
            const userEmail = oldUserMap[cat.User_ID];
            if (!userEmail) continue;
            const newUserId = userMap[userEmail];
            if (!newUserId) continue;

            const [exist] = await connection.execute(
                'SELECT Category_ID FROM CATEGORY WHERE User_ID = ? AND Category_Name = ?',
                [newUserId, cat.Category_Name]
            );

            if (exist.length === 0) {
                const [res] = await connection.execute(
                    'INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)',
                    [newUserId, cat.Category_Name, cat.Category_Type]
                );
                categoryMap[cat.Category_ID] = res.insertId;
            } else {
                categoryMap[cat.Category_ID] = exist[0].Category_ID;
            }
        }
        console.log(`  Processed ${Object.keys(categoryMap).length} categories.`);

        // 4. Migrate TRANSACTIONS
        // SQLite table is TRANSACTION_LOG
        console.log('\nMigrating TRANSACTIONS...');
        let transactions = [];
        try {
            transactions = await getSqliteData("SELECT * FROM TRANSACTION_LOG");
        } catch (e) {
            console.log('  No TRANSACTION_LOG table, trying TRANSACTION...');
            transactions = await getSqliteData("SELECT * FROM \`TRANSACTION\`");
        }

        for (const txn of transactions) {
            const userEmail = oldUserMap[txn.User_ID];
            if (!userEmail) continue;
            const newUserId = userMap[userEmail];

            const newAccountId = accountMap[txn.Account_ID];
            const newCategoryId = categoryMap[txn.Category_ID]; // Allowed to be null

            if (!newUserId || !newAccountId) {
                console.log(`  Skipping transaction ${txn.Transaction_ID}: Missing user or account link`);
                continue;
            }

            // Format Date: "2026-01-28T20:51:02.577Z" -> "2026-01-28 20:51:02"
            let txDate = txn.Transaction_DateTime;
            if (txDate && typeof txDate === 'string') {
                txDate = txDate.replace('T', ' ').replace('Z', '').split('.')[0];
            }

            // Check if Duplicate (heuristic: Same User, Amount, Date)
            const [exist] = await connection.execute(
                'SELECT Transaction_ID FROM \`TRANSACTION\` WHERE User_ID = ? AND Amount = ? AND Transaction_DateTime = ?',
                [newUserId, txn.Amount, txDate]
            );

            if (exist.length === 0) {
                await connection.execute(
                    `INSERT INTO \`TRANSACTION\` 
                    (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newUserId,
                        newAccountId,
                        newCategoryId || null,
                        txn.Amount,
                        txn.Transaction_Type,
                        txn.Reference_Type || 'Manual',  // Default if missing
                        txn.Description || '',
                        txDate
                    ]
                );
            }
        }
        console.log(`  Processed transactions.`);

        // 5. Migrate EMI
        // Let's try to migrate EMI if exists
        try {
            const emis = await getSqliteData("SELECT * FROM EMI");
            console.log('\nMigrating EMI...');
            for (const item of emis) {
                const userEmail = oldUserMap[item.User_ID];
                if (!userEmail) continue;
                const newUserId = userMap[userEmail];
                const newAccountId = accountMap[item.Account_ID];
                const newCategoryId = categoryMap[item.Category_ID];

                if (!newUserId || !newAccountId) continue;

                await connection.execute(
                    `INSERT INTO EMI (User_ID, Account_ID, Category_ID, EMI_Title, EMI_Amount, EMI_Day, Start_Date, End_Date, Status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newUserId, newAccountId, newCategoryId || null, item.EMI_Title || 'Migration EMI', item.EMI_Amount, item.EMI_Day, item.Start_Date, item.End_Date, 'Active']
                ).catch(err => console.log('  EMI Insert Error (dup/schema):', err.message));
            }
        } catch (e) { console.log('  No EMI table or error migrating EMIs'); }


        console.log('\nRestoring Triggers...');
        await connection.query(`
            CREATE TRIGGER trg_update_balance_after_transaction
            AFTER INSERT ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                IF NEW.Transaction_Type = 'Income' THEN
                    UPDATE ACCOUNT 
                    SET Balance = Balance + NEW.Amount 
                    WHERE Account_ID = NEW.Account_ID;
                ELSEIF NEW.Transaction_Type = 'Expense' THEN
                    UPDATE ACCOUNT 
                    SET Balance = Balance - NEW.Amount 
                    WHERE Account_ID = NEW.Account_ID;
                END IF;
            END
        `);

        await connection.query(`
            CREATE TRIGGER trg_update_summaries_after_transaction
            AFTER INSERT ON \`TRANSACTION\`
            FOR EACH ROW
            BEGIN
                 -- Logic inferred from standard implementation
                 INSERT INTO MONTHLY_SUMMARY (User_ID, Month_Year, Total_Income, Total_Expense)
                 VALUES (NEW.User_ID, DATE_FORMAT(NEW.Transaction_DateTime, '%Y-%m'), 
                        IF(NEW.Transaction_Type = 'Income', NEW.Amount, 0),
                        IF(NEW.Transaction_Type = 'Expense', NEW.Amount, 0))
                 ON DUPLICATE KEY UPDATE
                    Total_Income = Total_Income + IF(NEW.Transaction_Type = 'Income', NEW.Amount, 0),
                    Total_Expense = Total_Expense + IF(NEW.Transaction_Type = 'Expense', NEW.Amount, 0);
            END
        `);

        console.log('\nMigration Completed Successfully.');

    } catch (err) {
        console.error('Migration Error:', err);
    } finally {
        if (connection) await connection.end();
        dbSqlite.close();
    }
})();
