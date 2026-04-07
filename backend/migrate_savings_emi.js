const db = require('./db');

async function migrate() {
    console.log('🔄 Starting SAVINGS EMI migration...\n');

    try {
        // 1. Add new columns to SAVINGS table (use ALTER TABLE with IF NOT EXISTS logic)
        const columnsToAdd = [
            { name: 'EMI_Enabled', sql: 'ALTER TABLE SAVINGS ADD COLUMN EMI_Enabled BOOLEAN DEFAULT FALSE' },
            { name: 'EMI_Amount', sql: 'ALTER TABLE SAVINGS ADD COLUMN EMI_Amount DECIMAL(15,2) DEFAULT NULL' },
            { name: 'EMI_Date', sql: 'ALTER TABLE SAVINGS ADD COLUMN EMI_Date INT DEFAULT NULL' },
            { name: 'Account_ID', sql: 'ALTER TABLE SAVINGS ADD COLUMN Account_ID INT DEFAULT NULL' },
            { name: 'Last_EMI_Deducted', sql: 'ALTER TABLE SAVINGS ADD COLUMN Last_EMI_Deducted DATE DEFAULT NULL' },
        ];

        for (const col of columnsToAdd) {
            try {
                await db.execute(col.sql);
                console.log(`  ✅ Added column: ${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  ⏩ Column already exists: ${col.name}`);
                } else {
                    throw err;
                }
            }
        }

        // 2. Add FK constraint for Account_ID (if not exists)
        try {
            await db.execute(`
                ALTER TABLE SAVINGS 
                ADD CONSTRAINT fk_savings_account 
                FOREIGN KEY (Account_ID) REFERENCES ACCOUNT(Account_ID) ON DELETE SET NULL
            `);
            console.log('  ✅ Added FK: fk_savings_account');
        } catch (err) {
            if (err.code === 'ER_FK_DUP_NAME' || err.code === 'ER_DUP_KEYNAME' || err.errno === 1826) {
                console.log('  ⏩ FK fk_savings_account already exists');
            } else {
                console.log('  ⚠️  FK warning:', err.message);
            }
        }

        // 3. Create SAVINGS_EMI_HISTORY table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS SAVINGS_EMI_HISTORY (
                History_ID INT AUTO_INCREMENT PRIMARY KEY,
                Goal_ID INT NOT NULL,
                EMI_Amount DECIMAL(15,2) NOT NULL,
                Deduction_Date DATE NOT NULL,
                Status ENUM('Success', 'Failed') NOT NULL DEFAULT 'Success',
                Failure_Reason VARCHAR(255) DEFAULT NULL,
                Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (Goal_ID) REFERENCES SAVINGS(Goal_ID) ON DELETE CASCADE
            )
        `);
        console.log('  ✅ Created table: SAVINGS_EMI_HISTORY');

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
