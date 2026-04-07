const db = require('./db');

async function updateSchema() {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        console.log("🚀 Starting Schema Update for Budget Funds...");

        // 1. Create BUDGET_FUND Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS BUDGET_FUND (
                Fund_ID INT AUTO_INCREMENT PRIMARY KEY,
                User_ID INT NOT NULL,
                Fund_Name VARCHAR(100) NOT NULL,
                Description VARCHAR(255),
                Total_Amount DECIMAL(15, 2) NOT NULL CHECK (Total_Amount >= 0),
                Current_Balance DECIMAL(15, 2) DEFAULT 0.00 CHECK (Current_Balance >= 0),
                Status ENUM('Active', 'Closed') DEFAULT 'Active',
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (User_ID) REFERENCES USERS (User_ID) ON DELETE CASCADE
            )
        `);
        console.log("✅ Created BUDGET_FUND table.");

        // 2. Create BUDGET_EVENT Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS BUDGET_EVENT (
                Event_ID INT AUTO_INCREMENT PRIMARY KEY,
                Fund_ID INT NOT NULL,
                Event_Name VARCHAR(100) NOT NULL,
                Allocated_Amount DECIMAL(15, 2) NOT NULL CHECK (Allocated_Amount >= 0),
                Spent_Amount DECIMAL(15, 2) DEFAULT 0.00 CHECK (Spent_Amount >= 0),
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (Fund_ID) REFERENCES BUDGET_FUND (Fund_ID) ON DELETE CASCADE
            )
        `);
        console.log("✅ Created BUDGET_EVENT table.");

        // 3. Create Trigger to prevent Event Over-allocation
        // Ensure sum of allocated events doesn't exceed Fund Total (Optional but good)
        // For now, we'll handle this in application logic to be flexible.

        await connection.commit();
        console.log("✨ Schema Update Completed Successfully!");

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("❌ Schema Update Failed:", err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

updateSchema();
