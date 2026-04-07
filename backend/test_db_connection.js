require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

console.log('Attempting to connect to MySQL...');
console.log(`Host: ${process.env.DB_HOST}`);
console.log(`User: ${process.env.DB_USER}`);
console.log(`Database: ${process.env.DB_NAME}`);

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        process.exit(1);
    }
    console.log('Connected to MySQL as id ' + connection.threadId);

    connection.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
        if (error) {
            console.error('Error executing query:', error.stack);
            process.exit(1);
        }
        console.log('The solution is: ', results[0].solution);
        console.log('Database connection verification successful!');
        connection.end();
        process.exit(0);
    });
});
