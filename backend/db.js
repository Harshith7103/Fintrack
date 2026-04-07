const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Create a connection pool (Azure SQL Ready)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fintrack',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { 
        rejectUnauthorized: false  // Required for Azure MySQL Flexible Server
    } : undefined,
    // Connection timeout settings for Azure
    connectTimeout: 10000,
    acquireTimeout: 10000
});

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err.code, err.message);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Please check your .env file for correct credentials.');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error(`Database '${process.env.DB_NAME}' does not exist. Please create it.`);
        }
    } else {
        console.log('✅ Connected to MySQL database successfully.');
        console.log(`   Host: ${process.env.DB_HOST}`);
        console.log(`   Database: ${process.env.DB_NAME}`);
        console.log(`   SSL: ${process.env.DB_SSL === 'true' ? 'Enabled' : 'Disabled'}`);
        connection.release();

        // Optional: logic to initialize tables could go here, 
        // but it's better handled by migration scripts (e.g., 01_create_tables.sql)
        // to avoid mixing schema definition with connection logic.
    }
});

// Promisify for Node.js async/await
const promisePool = pool.promise();

module.exports = promisePool;
