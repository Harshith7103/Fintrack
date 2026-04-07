const db = require('../db');
const { MonthlyReport, TransactionMongo } = require('../mongodb');

/**
 * mysql2 row keys may be PascalCase or lowercase depending on server/OS.
 * @returns {object|null} fields for Mongo $set, or null if row is unusable
 */
function sqlRowToMongoDoc(t) {
    const tid = t.Transaction_ID ?? t.transaction_id;
    const uid = t.User_ID ?? t.user_id;
    if (tid == null || uid == null) return null;
    const transaction_id = Number(tid);
    const user_id = Number(uid);
    if (Number.isNaN(transaction_id) || Number.isNaN(user_id)) return null;
    const amount = parseFloat(t.Amount ?? t.amount);
    if (Number.isNaN(amount)) return null;
    const txType = t.Transaction_Type ?? t.transaction_type;
    if (!txType) return null;
    const dt = t.Transaction_DateTime ?? t.transaction_datetime;
    return {
        transaction_id,
        user_id,
        account_id: t.Account_ID ?? t.account_id ?? undefined,
        category_id: t.Category_ID ?? t.category_id ?? undefined,
        amount,
        status: 'SUCCESS',
        date: dt,
        type: txType,
        reference_type: (t.Reference_Type ?? t.reference_type) || 'Manual',
        description: (t.Description ?? t.description) || '',
    };
}

async function syncProjectData(userId, monthYear) {
    try {
        const targetMonth = monthYear || new Date().toISOString().substring(0, 7); // YYYY-MM
        const reportId = `real_rep_${targetMonth.replace('-', '_')}_u${userId}`;

        // 1. Fetch Transactions
        const [txs] = await db.query(`
            SELECT t.*, c.Category_Name 
            FROM \`TRANSACTION\` t
            LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
            WHERE t.User_ID = ? AND DATE_FORMAT(t.Transaction_DateTime, '%Y-%m') = ?
        `, [userId, targetMonth]);

        const income = [];
        const expenses = [];
        let totalInc = 0;
        let totalExp = 0;
        
        // Sync individual transactions to MongoDB for Admin Pipeline
        if (txs && txs.length > 0) {
            const bulkOps = txs
                .map((t) => {
                    const doc = sqlRowToMongoDoc(t);
                    if (!doc) return null;
                    return {
                        updateOne: {
                            filter: { transaction_id: doc.transaction_id },
                            update: { $set: doc },
                            upsert: true,
                        },
                    };
                })
                .filter(Boolean);
            try {
                if (bulkOps.length) await TransactionMongo.bulkWrite(bulkOps);
            } catch (err) {
                console.error('Error bulk writing transactions to mongo:', err.message);
            }
        }

        txs.forEach(t => {
            const row = { date: t.Transaction_DateTime, amount: parseFloat(t.Amount), category: t.Category_Name || 'System', description: t.Description || '' };
            if (t.Transaction_Type === 'Income') {
                income.push(row);
                totalInc += row.amount;
            } else if (t.Reference_Type !== 'Transfer') {
                // We only count actual spending, NOT internal transfers to budgets or goals
                expenses.push(row);
                totalExp += row.amount;
            }
        });

        // 2. Fetch Regular Budgets
        const [regBudgets] = await db.query(`
            SELECT b.*, c.Category_Name 
            FROM BUDGET b
            JOIN CATEGORY c ON b.Category_ID = c.Category_ID
            WHERE b.User_ID = ? AND b.Month_Year = ?
        `, [userId, targetMonth]);

        // 3. Fetch Event Budgets (The ones from the 'Budgets' page in the UI)
        const [eventBudgets] = await db.query(`
            SELECT * FROM BUDGET_V2 
            WHERE User_ID = ? AND Status != 'Deleted'
        `, [userId]);

        const finalBudgets = [
            ...regBudgets.map(b => ({ category_name: b.Category_Name, allocated_amount: parseFloat(b.Budget_Amount), spent_amount: 0, status: 'Active' })),
            ...eventBudgets.map(e => ({ category_name: `Event: ${e.Budget_Name}`, allocated_amount: parseFloat(e.Total_Budget_Amount), spent_amount: parseFloat(e.Total_Budget_Amount - e.Remaining_Budget_Amount), status: e.Status }))
        ];

        // 4. Fetch Goals
        const [goals] = await db.query('SELECT * FROM SAVINGS WHERE User_ID = ?', [userId]);

        // 5. Net Worth
        const [accRows] = await db.query('SELECT SUM(Balance) as Net_Worth FROM ACCOUNT WHERE User_ID = ?', [userId]);
        const [userRows] = await db.query('SELECT Name FROM USERS WHERE User_ID = ?', [userId]);
        const userName = userRows[0]?.Name || 'Unknown User';
        const netWorth = parseFloat(accRows[0]?.Net_Worth || 0);

        // SYNC TO MONGODB
        await MonthlyReport.findOneAndUpdate(
            { report_id: reportId },
            { 
                user_id: userId,
                user_name: userName,
                month: targetMonth,
                summary: { total_income: totalInc, total_expense: totalExp, net_savings: totalInc - totalExp, closing_balance: netWorth },
                transactions: { income, expenses },
                budgets: finalBudgets,
                goals: goals.map(g => ({
                    goal_title: g.Goal_Title,
                    target_amount: parseFloat(g.Target_Amount),
                    current_amount: parseFloat(g.Current_Amount) || 0,
                    progress_percentage: ((parseFloat(g.Current_Amount) || 0) / parseFloat(g.Target_Amount) * 100).toFixed(2),
                    status: g.Status
                })),
                generated_at: new Date()
            },
            { upsert: true }
        );

        console.log(`[SYNC] Fully mirrored User ${userId} (${userName}) to MongoDB.`);
    } catch (err) {
        console.error('[SYNC ERROR]:', err.message);
    }
}

const CHUNK = 800;

/** Upsert every row from MySQL TRANSACTION into MongoDB (all users, full history) for admin pipelines. */
async function syncAllSqlTransactionsToMongo() {
    const [[{ distinct_users }]] = await db.query(
        'SELECT COUNT(DISTINCT User_ID) AS distinct_users FROM `TRANSACTION`'
    );
    const [rows] = await db.query(`
        SELECT Transaction_ID, User_ID, Account_ID, Category_ID, Amount,
               Transaction_Type, Reference_Type, Description, Transaction_DateTime
        FROM \`TRANSACTION\`
        ORDER BY Transaction_ID
    `);
    let processed = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const bulkOps = [];
        for (const t of slice) {
            const doc = sqlRowToMongoDoc(t);
            if (!doc) {
                skipped += 1;
                continue;
            }
            bulkOps.push({
                updateOne: {
                    filter: { transaction_id: doc.transaction_id },
                    update: { $set: doc },
                    upsert: true,
                },
            });
        }
        if (bulkOps.length) {
            await TransactionMongo.bulkWrite(bulkOps, { ordered: false });
            processed += bulkOps.length;
        }
    }
    if (skipped > 0) {
        console.warn(`[syncAllSqlTransactionsToMongo] Skipped ${skipped} MySQL row(s) (missing/invalid keys).`);
    }
    return {
        transaction_count: processed,
        user_count: Number(distinct_users) || 0,
        skipped_rows: skipped,
        mysql_rows_read: rows.length,
    };
}

module.exports = { syncProjectData, syncAllSqlTransactionsToMongo };
