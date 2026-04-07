const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sqlitePath = path.join(__dirname, 'fintrack.db');

(async () => {
    let sqliteDb;
    let mysqlDb;

    try {
        // Connect to MySQL
        mysqlDb = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'fintrack_final'
        });

        // Connect to SQLite
        sqliteDb = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
            if (err) throw err;
        });

        // Helper to query SQLite
        const querySqlite = (sql, params = []) => {
            return new Promise((resolve, reject) => {
                sqliteDb.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const events = await querySqlite('SELECT * FROM EVENTS');
        console.log(`Found ${events.length} events in SQLite.`);

        for (const ev of events) {
            // Check if exists in MySQL
            const [existing] = await mysqlDb.query('SELECT Event_ID FROM EVENTS WHERE Event_ID = ?', [ev.Event_ID]);
            if (existing.length === 0) {
                await mysqlDb.query(
                    `INSERT INTO EVENTS (Event_ID, User_ID, Title, Description, Total_Budget, Remaining_Budget, Status, Created_At)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ev.Event_ID, ev.User_ID, ev.Title, ev.Description, ev.Total_Budget, ev.Remaining_Budget, ev.Status, ev.Created_At || new Date()]
                );
            }
        }

        const categories = await querySqlite('SELECT * FROM EVENT_CATEGORIES');
        console.log(`Found ${categories.length} categories in SQLite.`);

        for (const cat of categories) {
             const [existing] = await mysqlDb.query('SELECT Category_ID FROM EVENT_CATEGORIES WHERE Category_ID = ?', [cat.Category_ID]);
             if (existing.length === 0) {
                 await mysqlDb.query(
                     `INSERT INTO EVENT_CATEGORIES (Category_ID, Event_ID, Category_Name, Allocated_Amount, Spent_Amount)
                      VALUES (?, ?, ?, ?, ?)`,
                     [cat.Category_ID, cat.Event_ID, cat.Category_Name, cat.Allocated_Amount, cat.Spent_Amount]
                 );
             }
        }

        console.log('Migration of EVENTS and EVENT_CATEGORIES complete.');

        // Force a sync for user 25 just in case
        const { syncProjectData } = require('./utils/syncHelper');
        await syncProjectData(25);
        console.log('Synced user 25 to MongoDB.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (sqliteDb) sqliteDb.close();
        if (mysqlDb) await mysqlDb.end();
        process.exit();
    }
})();
