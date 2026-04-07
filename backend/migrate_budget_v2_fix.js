const db = require('./db');

async function migrate() {
    console.log('🔄 Updating BUDGET_V2 enums...\n');
    try {
        // 1. Add 'Deleted' to Status enum
        await db.execute(`
            ALTER TABLE BUDGET_V2 
            MODIFY COLUMN Status ENUM('Active','Completed','Deleted') DEFAULT 'Active'
        `);
        console.log('  ✅ Status enum updated (Active, Completed, Deleted)');

        // 2. Add 'DELETE_REFUND' to Transaction_Type enum
        await db.execute(`
            ALTER TABLE BUDGET_TRANSACTION 
            MODIFY COLUMN Transaction_Type ENUM('CREATE','ALLOCATE','SPEND','INCREASE','REALLOCATE','DELETE_REFUND') NOT NULL
        `);
        console.log('  ✅ Transaction_Type enum updated (added DELETE_REFUND)');

        console.log('\n✅ Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
