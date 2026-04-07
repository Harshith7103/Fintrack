const db = require('./db');

async function migrate() {
    console.log('🔄 Starting Dynamic Budget Module migration...\n');

    try {
        // 1. Drop old tables if they exist (reverse order for FK)
        console.log('  Cleaning up old budget tables...');
        await db.execute('DROP TABLE IF EXISTS BUDGET_TRANSACTION');
        await db.execute('DROP TABLE IF EXISTS BUDGET_EVENTS');
        await db.execute('DROP TABLE IF EXISTS BUDGET_EVENT');
        await db.execute('DROP TABLE IF EXISTS BUDGET_FUND');

        // 2. Create new BUDGET_V2 table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS BUDGET_V2 (
                Budget_ID INT AUTO_INCREMENT PRIMARY KEY,
                User_ID INT NOT NULL,
                Budget_Name VARCHAR(100) NOT NULL,
                Initial_Budget_Amount DECIMAL(15,2) NOT NULL CHECK (Initial_Budget_Amount > 0),
                Total_Budget_Amount DECIMAL(15,2) NOT NULL CHECK (Total_Budget_Amount > 0),
                Remaining_Budget_Amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                Source_Account_ID INT NOT NULL,
                Status ENUM('Active', 'Completed') DEFAULT 'Active',
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (User_ID) REFERENCES USERS(User_ID) ON DELETE CASCADE,
                FOREIGN KEY (Source_Account_ID) REFERENCES ACCOUNT(Account_ID) ON DELETE RESTRICT,
                CHECK (Remaining_Budget_Amount >= 0),
                CHECK (Total_Budget_Amount >= Initial_Budget_Amount)
            )
        `);
        console.log('  ✅ Created BUDGET_V2 table');

        // 3. Create BUDGET_EVENTS table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS BUDGET_EVENTS (
                Event_ID INT AUTO_INCREMENT PRIMARY KEY,
                Budget_ID INT NOT NULL,
                Event_Name VARCHAR(100) NOT NULL,
                Allocated_Amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (Allocated_Amount >= 0),
                Remaining_Event_Amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (Remaining_Event_Amount >= 0),
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (Budget_ID) REFERENCES BUDGET_V2(Budget_ID) ON DELETE CASCADE
            )
        `);
        console.log('  ✅ Created BUDGET_EVENTS table');

        // 4. Create BUDGET_TRANSACTION table (full audit log)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS BUDGET_TRANSACTION (
                Transaction_ID INT AUTO_INCREMENT PRIMARY KEY,
                Budget_ID INT NOT NULL,
                Event_ID INT DEFAULT NULL,
                Transaction_Type ENUM('CREATE', 'ALLOCATE', 'SPEND', 'INCREASE', 'REALLOCATE') NOT NULL,
                Amount DECIMAL(15,2) NOT NULL,
                Previous_Budget_Balance DECIMAL(15,2),
                New_Budget_Balance DECIMAL(15,2),
                Previous_Event_Balance DECIMAL(15,2) DEFAULT NULL,
                New_Event_Balance DECIMAL(15,2) DEFAULT NULL,
                Description VARCHAR(255) DEFAULT NULL,
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (Budget_ID) REFERENCES BUDGET_V2(Budget_ID) ON DELETE CASCADE,
                FOREIGN KEY (Event_ID) REFERENCES BUDGET_EVENTS(Event_ID) ON DELETE SET NULL
            )
        `);
        console.log('  ✅ Created BUDGET_TRANSACTION table');

        console.log('\n✅ Dynamic Budget Module migration completed!');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
