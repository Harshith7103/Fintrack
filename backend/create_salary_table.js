const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Connected to database.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS SALARY (
                Salary_ID INT AUTO_INCREMENT PRIMARY KEY,
                User_ID INT NOT NULL,
                Account_ID INT NOT NULL,
                Category_ID INT NOT NULL,
                Amount DECIMAL(15,2) NOT NULL,
                Salary_Day INT NOT NULL,
                Status VARCHAR(20) DEFAULT 'Active',
                Last_Credited DATETIME,
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (User_ID) REFERENCES USERS(User_ID),
                FOREIGN KEY (Account_ID) REFERENCES ACCOUNT(Account_ID),
                FOREIGN KEY (Category_ID) REFERENCES CATEGORY(Category_ID)
            );
        `;

        await connection.execute(createTableQuery);
        console.log('SALARY table created successfully.');

    } catch (err) {
        console.error('Error creating table:', err);
        // Try fallback for .env path if needed, but assuming standard node run from root
    } finally {
        if (connection) await connection.end();
    }
})();
