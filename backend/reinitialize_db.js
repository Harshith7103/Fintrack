const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sqlFiles = [
    path.join(__dirname, '../database/mysql/01_create_tables.sql'),
    path.join(__dirname, '../database/mysql/02_stored_procedures.sql')
];

(async () => {
    let connection;
    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            multipleStatements: true
        });

        for (const sqlFilePath of sqlFiles) {
            console.log(`Reading SQL file: ${sqlFilePath}...`);
            const content = fs.readFileSync(sqlFilePath, 'utf8');
            const lines = content.split(/\r?\n/);
            let currentDelimiter = ';';
            let buffer = [];

            console.log(`Executing ${path.basename(sqlFilePath)}...`);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                if (trimmed.toUpperCase().startsWith('DELIMITER')) {
                    const parts = trimmed.split(/\s+/);
                    if (trimmed.endsWith(';')) {
                        currentDelimiter = ';';
                        continue;
                    }
                    if (parts.length >= 2) {
                        currentDelimiter = parts[1];
                    }
                    continue;
                }

                buffer.push(line);
                const currentBlock = buffer.join('\n').trim();

                if (currentBlock.endsWith(currentDelimiter)) {
                    let statement = currentBlock.slice(0, -currentDelimiter.length).trim();
                    if (statement.length > 0) {
                        try {
                            await connection.query(statement);
                        } catch (err) {
                            console.error('Failed SQL:', statement.substring(0, 100));
                            throw err;
                        }
                    }
                    buffer = [];
                }
            }
        }
        console.log('✅ All SQL files executed successfully. Database initialized.');
    } catch (err) {
        console.error('Error initializing database:', err.message);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
})();
