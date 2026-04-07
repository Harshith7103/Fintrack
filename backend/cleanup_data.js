const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

const cleanup = async () => {
    console.log("🧹 Starting Category Cleanup...");

    db.serialize(() => {
        // 1. Find duplicates
        const sql = `
            SELECT User_ID, Category_Name, GROUP_CONCAT(Category_ID) as IDs
            FROM CATEGORY
            GROUP BY User_ID, Category_Name
            HAVING COUNT(*) > 1
        `;

        db.all(sql, async (err, rows) => {
            if (err) {
                console.error("❌ Error finding duplicates:", err);
                return;
            }

            if (rows.length === 0) {
                console.log("✅ No duplicates found.");
                return;
            }

            console.log(`Found ${rows.length} duplicate sets. Merging...`);

            for (const row of rows) {
                const ids = row.IDs.split(',').sort((a, b) => a - b);
                const keepId = ids[0];
                const removeIds = ids.slice(1);

                console.log(`   User ${row.User_ID} '${row.Category_Name}': Keeping ${keepId}, Removing ${removeIds.join(',')}`);

                // 2. Update references to point to keepId
                const updateTables = [
                    'TRANSACTION_LOG', 'EMI', 'BUDGET', 'SALARY', 'CATEGORY_SUMMARY'
                ];

                const runQuery = (query, params) => {
                    return new Promise((resolve, reject) => {
                        db.run(query, params, function (err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                    });
                };

                for (const table of updateTables) {
                    try {
                        const changes = await runQuery(
                            `UPDATE ${table} SET Category_ID = ? WHERE Category_ID IN (${removeIds.join(',')})`,
                            [keepId]
                        );
                        if (changes > 0) console.log(`      Updated ${changes} records in ${table}`);
                    } catch (e) {
                        console.error(`      ❌ Error updating ${table}:`, e.message);
                    }
                }

                // 3. Delete duplicates
                try {
                    const changes = await runQuery(
                        `DELETE FROM CATEGORY WHERE Category_ID IN (${removeIds.join(',')})`,
                        []
                    );
                    console.log(`      Deleted ${changes} duplicate categories.`);
                } catch (e) {
                    console.error(`      ❌ Error deleting categories:`, e.message);
                }
            }
            console.log("✅ Cleanup Complete!");
        });
    });
};

cleanup();
