const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const db = require('../db');
const { TransactionMongo, Notification, AdminLog } = require('../mongodb');
const { ensureMongo } = require('../utils/mongoReady');
const { syncAllSqlTransactionsToMongo } = require('../utils/syncHelper');
const { refreshMongoTransactionsForAdmin, attachUserNames } = require('../utils/adminPipelineHelper');
const {
    STAGE_MATCH_ALL,
    STAGE_GROUP_BY_USER,
    STAGE_PROJECT_OUTPUT,
    PROJECTION_OUTPUT_SHAPE,
    chainDescription,
} = require('../utils/pipelineDefinitions');

// Helper
const sendError = (res, err, status = 500) => res.status(status).json({ success: false, error: err.message });

// 1. GET ADMIN DASHBOARD STATS
router.get('/stats', async (req, res) => {
    try {
        const [[userCount]] = await db.query('SELECT COUNT(*) as count FROM USERS');
        const [[txStats]] = await db.query('SELECT COUNT(*) as count, SUM(Amount) as rev FROM `TRANSACTION`');
        
        // 1. Fetch Transaction Trend (Last 90 Days for detailed volume/count analysis)
        const [trends] = await db.query(`
            SELECT DATE(Transaction_DateTime) as date, 
                   COUNT(*) as total_count, 
                   COUNT(CASE WHEN Transaction_Type = 'Income' THEN 1 END) as income_count,
                   COUNT(CASE WHEN Transaction_Type = 'Expense' THEN 1 END) as expense_count,
                   SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END) as expenses,
                   SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END) as income
            FROM \`TRANSACTION\`
            WHERE Transaction_DateTime >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            GROUP BY DATE(Transaction_DateTime)
            ORDER BY date ASC
        `);

        // 2. Risk Profiles & MongoDB Stats (Unchanged check)
        let highRiskCount = 0;
        let mediumRiskCount = 0;
        let lowRiskCount = 0;
        let alertsGenerated = 0;

        if (mongoose.connection.readyState === 1) {
            alertsGenerated = await Notification.countDocuments();
            const riskPipeline = [ STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, STAGE_PROJECT_OUTPUT ];
            const allRiskData = await TransactionMongo.aggregate(riskPipeline);
            
            if (allRiskData.length > 0) {
                allRiskData.forEach(user => {
                    if (user.risk_level === 'HIGH') highRiskCount++;
                    else if (user.risk_level === 'MEDIUM') mediumRiskCount++;
                    else lowRiskCount++;
                });
            }
        }

        // 3. Category Distribution (Top 8, resilient to NULL or missing cats)
        const [categories] = await db.query(`
            SELECT COALESCE(c.Category_Name, 'Uncategorized') as name, COUNT(*) as value
            FROM \`TRANSACTION\` t
            LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
            GROUP BY name
            ORDER BY value DESC
            LIMIT 8
        `);

        res.json({
            success: true,
            totalUsers: userCount.count,
            totalTransactions: txStats.count,
            totalRevenue: txStats.rev || 0,
            highRiskCount,
            mediumRiskCount,
            lowRiskCount,
            alertsGenerated,
            trends: (trends && trends.length > 0) ? trends.map(t => ({
                date: t.date ? new Date(t.date).toISOString().split('T')[0] : '—',
                totalCount: Number(t.total_count || 0),
                incomeCount: Number(t.income_count || 0),
                expenseCount: Number(t.expense_count || 0),
                income: Number(t.income || 0),
                expenses: Number(t.expenses || 0)
            })) : [
                { date: 'Initial', totalCount: 1, incomeCount: 1, expenseCount: 1, income: 100, expenses: 50 }
            ],
            categories: (categories && categories.length > 0) ? categories.map(c => ({ 
                name: String(c.name || 'Uncategorized'), 
                value: Number(c.value || 0) 
            })) : [
                { name: 'Loading Data...', value: 1 }
            ],
            riskDistribution: [
                { name: 'High', value: highRiskCount, color: '#ef4444' },
                { name: 'Medium', value: mediumRiskCount, color: '#f59e0b' },
                { name: 'Low', value: lowRiskCount || (highRiskCount === 0 && mediumRiskCount === 0 ? 1 : 0), color: '#10b981' }
            ]
        });
    } catch (err) { sendError(res, err); }
});

// 2. GET ALL USERS (Admin View)
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT User_ID, Name, Email, role,
                    COALESCE(Account_Status, 'active') AS Account_Status
             FROM USERS`
        );
        res.json({ success: true, users });
    } catch (err) { sendError(res, err); }
});

/** Bucket a transaction row for admin drill-down (MySQL row shape). */
function bucketTransactionForAdmin(row) {
    const ref = String(row.Reference_Type || '').toLowerCase();
    const type = String(row.Transaction_Type || '').toLowerCase();
    const cat = String(row.Category_Name || '').toLowerCase();
    const desc = String(row.Description || '').toLowerCase();

    if (type === 'income') return 'income';
    if (ref === 'emi') return 'emi';
    if (ref === 'transfer') return 'transfer';
    if (ref === 'bill' || desc.includes('budget') || cat.includes('budget')) return 'budget_related';
    if (desc.includes('saving') || desc.includes('goal') || cat.includes('saving') || cat.includes('goal'))
        return 'savings_related';
    if (type === 'expense') return 'expense';
    return 'other';
}

async function safeTableQuery(sql, params) {
    try {
        const [rows] = await db.query(sql, params);
        return rows;
    } catch (e) {
        console.warn('[admin/activity] optional query skipped:', e.code || e.message);
        return [];
    }
}

/** Full admin drill-down for one user (MySQL). Returns null if user does not exist. */
async function buildUserActivityPayload(userId) {
    const [userRows] = await db.query(
        `SELECT User_ID, Name, Email, role, Occupation, Monthly_Income, Created_At,
                COALESCE(Account_Status, 'active') AS Account_Status
         FROM USERS WHERE User_ID = ?`,
        [userId]
    );
    const user = userRows[0];
    if (!user) return null;

    const [phoneRows] = await db.query(
        'SELECT Phone_No FROM USER_PHONES WHERE User_ID = ? ORDER BY Is_Primary DESC, Phone_ID ASC',
        [userId]
    );
    user.phones = phoneRows.map((r) => r.Phone_No);

    const [txRows] = await db.query(
        `
        SELECT t.Transaction_ID, t.User_ID, t.Account_ID, t.Category_ID, t.Amount, t.Transaction_Type,
               t.Reference_Type, t.Description, t.Transaction_DateTime,
               COALESCE(c.Category_Name, '—') AS Category_Name,
               COALESCE(a.Account_Name, '—') AS Account_Name
        FROM \`TRANSACTION\` t
        LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID AND c.User_ID = t.User_ID
        LEFT JOIN ACCOUNT a ON t.Account_ID = a.Account_ID AND t.User_ID = a.User_ID
        WHERE t.User_ID = ?
        ORDER BY t.Transaction_DateTime DESC, t.Transaction_ID DESC
        `,
        [userId]
    );

    // Calculate risk metrics for alert reasoning
    const totalSpent = txRows.reduce((sum, t) => sum + (t.Transaction_Type === 'Expense' ? Number(t.Amount) : 0), 0);
    const largeTxns = txRows.filter(t => t.Transaction_Type === 'Expense' && Number(t.Amount) > 10000).length;
    
    let riskReason = "Normal spending patterns.";
    if (totalSpent > 100000) riskReason = "Critical: Cumulative spending exceeds ₹1,00,000.";
    else if (totalSpent > 50000) riskReason = "High: Cumulative spending exceeds ₹50,000 threshold.";
    else if (largeTxns > 0) riskReason = `Warning: ${largeTxns} single transaction(s) exceed ₹10,000.`;

    const transactions = {
        income: [],
        expense: [],
        emi: [],
        budget_related: [],
        savings_related: [],
        transfer: [],
        other: []
    };
    for (const row of txRows) {
        const bucket = bucketTransactionForAdmin(row);
        if (transactions[bucket]) transactions[bucket].push(row);
        else transactions.other.push(row);
    }

    const accounts = await safeTableQuery(
        'SELECT Account_ID, Account_Name, Account_Type, Balance, Created_At FROM ACCOUNT WHERE User_ID = ? ORDER BY Account_ID',
        [userId]
    );

    const budgets = await safeTableQuery(
        `SELECT b.Budget_ID, b.Category_ID, b.Budget_Amount, b.Month_Year, c.Category_Name
         FROM BUDGET b
         LEFT JOIN CATEGORY c ON b.Category_ID = c.Category_ID AND c.User_ID = b.User_ID
         WHERE b.User_ID = ?
         ORDER BY b.Month_Year DESC, b.Budget_ID DESC`,
        [userId]
    );

    const budget_v2 = await safeTableQuery(
        `SELECT Budget_ID, Budget_Name, Initial_Budget_Amount, Total_Budget_Amount, Remaining_Budget_Amount, Status, Source_Account_ID
         FROM BUDGET_V2 WHERE User_ID = ? ORDER BY Budget_ID DESC`,
        [userId]
    );

    const savings_goals = await safeTableQuery(
        `SELECT Goal_ID, Goal_Title, Target_Amount, Current_Amount, Start_Date, EMI_Enabled, EMI_Amount, Account_ID
         FROM SAVINGS WHERE User_ID = ? ORDER BY Goal_ID DESC`,
        [userId]
    );

    const emi_plans = await safeTableQuery(
        `SELECT EMI_ID, EMI_Title, EMI_Amount, EMI_Day, Status, Account_ID, Category_ID, Last_Deducted
         FROM EMI WHERE User_ID = ? ORDER BY EMI_ID DESC`,
        [userId]
    );

    return {
        success: true,
        user,
        accounts,
        transactions,
        budgets,
        savings_goals,
        emi_plans,
        risk_analysis: {
            total_spent: totalSpent,
            total_income: txRows.reduce((sum, t) => sum + (t.Transaction_Type === 'Income' ? Number(t.Amount) : 0), 0),
            large_transactions: largeTxns,
            reason: riskReason,
            risk_level: (totalSpent / (txRows.reduce((sum, t) => sum + (t.Transaction_Type === 'Income' ? Number(t.Amount) : 0), 0) || 1)) > 0.9 ? 'HIGH' : 
                        (totalSpent / (txRows.reduce((sum, t) => sum + (t.Transaction_Type === 'Income' ? Number(t.Amount) : 0), 0) || 1)) > 0.7 ? 'MEDIUM' : 'LOW'
        },
        transaction_counts: {
            total: txRows.length,
            income: transactions.income.length,
            expense: transactions.expense.length,
            emi: transactions.emi.length,
            budget_related: transactions.budget_related.length,
            savings_related: transactions.savings_related.length,
            transfer: transactions.transfer.length,
            other: transactions.other.length
        }
    };
}

// Prefer this path in the UI — avoids any client/proxy confusion with "/users/.../activity"
router.get('/activity/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (!Number.isFinite(userId) || userId < 1) {
            return res.status(400).json({ success: false, error: 'Invalid user id' });
        }
        const payload = await buildUserActivityPayload(userId);
        if (!payload) return res.status(404).json({ success: false, error: 'User not found' });
        res.json(payload);
    } catch (err) {
        sendError(res, err);
    }
});

// Legacy / alternate path (same payload)
router.get('/users/:id/activity', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!Number.isFinite(userId) || userId < 1) {
            return res.status(400).json({ success: false, error: 'Invalid user id' });
        }
        const payload = await buildUserActivityPayload(userId);
        if (!payload) return res.status(404).json({ success: false, error: 'User not found' });
        res.json(payload);
    } catch (err) {
        sendError(res, err);
    }
});

// 2c. Block user (cannot log in)
router.post('/users/:id/block', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user id' });

        const [rows] = await db.query('SELECT User_ID, role FROM USERS WHERE User_ID = ?', [userId]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
        if (rows[0].role === 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Cannot block an administrator account' });
        }

        await db.query(`UPDATE USERS SET Account_Status = 'blocked' WHERE User_ID = ?`, [userId]);
        res.json({ success: true, message: `User ${userId} is blocked and cannot sign in.` });
    } catch (err) {
        sendError(res, err);
    }
});

// 2d. Unblock user
router.post('/users/:id/unblock', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user id' });

        const [rows] = await db.query('SELECT User_ID FROM USERS WHERE User_ID = ?', [userId]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });

        await db.query(`UPDATE USERS SET Account_Status = 'active' WHERE User_ID = ?`, [userId]);
        res.json({ success: true, message: `User ${userId} is active again.` });
    } catch (err) {
        sendError(res, err);
    }
});

// 2e. Send manual notification/alert to user
router.post('/notifications/send', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, error: 'MongoDB connection not ready' });
        }
        const { user_id, message } = req.body;
        if (!user_id || !message) {
            return res.status(400).json({ success: false, error: 'User ID and message are required' });
        }

        const [userExists] = await db.query('SELECT User_ID FROM USERS WHERE User_ID = ?', [user_id]);
        if (!userExists.length) {
            return res.status(404).json({ success: false, error: 'User not found in system' });
        }

        const notification = await Notification.create({
            user_id: parseInt(user_id, 10),
            message: message,
            type: 'MANUAL',
            timestamp: new Date(),
            is_read: false
        });

        res.json({ 
            success: true, 
            message: 'Notification sent successfully to user.',
            notification 
        });
    } catch (err) {
        sendError(res, err);
    }
});

// 3a. Sync all MySQL transactions → MongoDB (all users, full history) — run before pipeline analytics
router.post('/mongo/sync-transactions', async (req, res) => {
    try {
        if (!ensureMongo(res)) return;
        const meta = await syncAllSqlTransactionsToMongo();
        res.json({
            success: true,
            message: `Synced ${meta.transaction_count} transaction(s) from MySQL across ${meta.user_count} user(s).`,
            transaction_count: meta.transaction_count,
            user_count: meta.user_count,
            mysql_rows_read: meta.mysql_rows_read,
            skipped_rows: meta.skipped_rows,
        });
    } catch (err) {
        sendError(res, err);
    }
});

// 3. EXECUTE MONGODB PIPELINES

// Full Pipeline — All stages combined
router.get('/pipeline/full', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [
            STAGE_MATCH_ALL,
            STAGE_GROUP_BY_USER,
            STAGE_PROJECT_OUTPUT,
            { $sort: { total_spent: -1 } }
        ];

        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);

        // Auto-notification for Risk Management
        const alerts = [];
        for (const record of data) {
            // Case 1: HIGH risk detected
            if (record.risk_level === 'HIGH') {
                const reason = `High spending alert: ₹${record.total_spent.toLocaleString()} detected.`;
                const message = `⚠️ ${reason} Review your transactions immediately.`;
                const exists = await Notification.findOne({ user_id: record.user_id, message });
                if (!exists) {
                    await Notification.create({ 
                        user_id: record.user_id, 
                        message,
                        type: 'AUTOMATED',
                        alert_type: 'WARNING',
                        alert_status: 'ACTIVE',
                        details: { 
                            reason: "Automated high-risk spending detection pipeline",
                            total_spent: record.total_spent
                        }
                    });
                    alerts.push({ user_id: record.user_id, message });
                }
            } 
            // Case 2: Risk RESOLVED (Drops below HIGH)
            else {
                // Find active warnings
                const activeWarnings = await Notification.find({ user_id: record.user_id, alert_type: 'WARNING', alert_status: 'ACTIVE' });
                
                if (activeWarnings && activeWarnings.length > 0) {
                    // Update them to resolved
                    await Notification.updateMany(
                        { user_id: record.user_id, alert_type: 'WARNING', alert_status: 'ACTIVE' },
                        { $set: { alert_status: 'RESOLVED', resolved_at: new Date() } }
                    );

                    // Prevent duplicate resolved alerts
                    const resolvedMessage = `✅ Your account risk has been resolved after updating your balance.`;
                    const exists = await Notification.findOne({ user_id: record.user_id, message: resolvedMessage, alert_status: 'RESOLVED' });
                    
                    if (!exists) {
                        await Notification.create({
                            user_id: record.user_id,
                            message: resolvedMessage,
                            type: 'AUTOMATED',
                            alert_type: 'RESOLVED',
                            alert_status: 'RESOLVED',
                            resolved_at: new Date(),
                            details: { reason: "User has resolved the issue by updating account balance." }
                        });
                    }
                }
            }
        }

        res.json({
            success: true,
            stage: 'Full Pipeline ($match → $group → $project → $sort)',
            description: chainDescription([
                '$match: {} (all users, all documents)',
                '$group by user_id',
                '$project final shape + risk',
                '$sort by total_spent desc',
            ]),
            projection_output_shape: PROJECTION_OUTPUT_SHAPE,
            pipeline_chain: ['$match: {}', '$group', '$project', '$sort'],
            count: data.length,
            alerts_generated: alerts.length,
            data
        });
    } catch (err) { sendError(res, err); }
});

// Stage 1: $match — all documents, all users (no User_ID filter)
router.get('/pipeline/match', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, { $sort: { user_id: 1, transaction_id: 1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);
        res.json({
            success: true,
            stage: '$match',
            query: '{ $match: {} }',
            description: 'Matches every document in transactions — all users, all rows (empty filter = no restriction).',
            pipeline_chain: ['$match: {}'],
            count: data.length,
            data
        });
    } catch (err) { sendError(res, err); }
});

// Stage 2: $match + $group — aggregate every user after matching all
router.get('/pipeline/group', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, { $sort: { _id: 1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r._id);
        res.json({
            success: true,
            stage: '$group',
            query: '{ $match: {} }, { $group: { _id: "$user_id", total_spent, transaction_count, avg_amount } }',
            description: chainDescription(['$match: {} (all users)', '$group by user_id (sums for each user)']),
            pipeline_chain: ['$match: {}', '$group'],
            count: data.length,
            data
        });
    } catch (err) { sendError(res, err); }
});

// Stage 3: $match → $group → $project — final projected document per user (all users)
router.get('/pipeline/project', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, STAGE_PROJECT_OUTPUT, { $sort: { user_id: 1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);
        res.json({
            success: true,
            stage: '$project',
            query: '{ $match: {} }, { $group: ... }, { $project: { user_id, total_spent, transaction_count, avg_amount, risk_level } }',
            description: chainDescription([
                '$match: {} (all users)',
                '$group by user_id',
                '$project — final output shape + HIGH/LOW risk',
            ]),
            projection_output_shape: PROJECTION_OUTPUT_SHAPE,
            pipeline_chain: ['$match: {}', '$group', '$project'],
            count: data.length,
            data
        });
    } catch (err) { sendError(res, err); }
});

// Stage 4: full chain through $sort — same projection as $project, ordered by spending
router.get('/pipeline/sort', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, STAGE_PROJECT_OUTPUT, { $sort: { total_spent: -1 } }];
        const raw = await TransactionMongo.aggregate(pipeline);
        const ranked = raw.map((d, i) => ({ rank: i + 1, ...d }));
        const data = await attachUserNames(ranked, (r) => r.user_id);
        res.json({
            success: true,
            stage: '$sort',
            query: '{ $match: {} }, { $group }, { $project }, { $sort: { total_spent: -1 } }',
            description: chainDescription([
                '$match → $group → $project (final shape)',
                '$sort by total_spent descending — ranking for all users',
            ]),
            projection_output_shape: PROJECTION_OUTPUT_SHAPE,
            pipeline_chain: ['$match: {}', '$group', '$project', '$sort'],
            count: data.length,
            data
        });
    } catch (err) { sendError(res, err); }
});

// Alias for compatibility if needed
router.get('/pipeline', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, STAGE_PROJECT_OUTPUT, { $sort: { total_spent: -1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);
        res.json({ success: true, projection_output_shape: PROJECTION_OUTPUT_SHAPE, data });
    } catch (err) { sendError(res, err); }
});

// 4. GET ALL TRANSACTIONS WITH USER / ACCOUNT / CATEGORY (full admin view)
router.get('/transactions', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15000, 1), 25000);
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `TRANSACTION`');
        const [txs] = await db.query(
            `
            SELECT t.Transaction_ID,
                   t.User_ID,
                   u.Name AS User_Name,
                   u.Email AS User_Email,
                   t.Account_ID,
                   a.Account_Name,
                   t.Category_ID,
                   COALESCE(c.Category_Name, '—') AS Category_Name,
                   t.Amount,
                   t.Transaction_Type,
                   t.Reference_Type,
                   t.Description,
                   t.Transaction_DateTime
            FROM \`TRANSACTION\` t
            INNER JOIN USERS u ON t.User_ID = u.User_ID
            LEFT JOIN ACCOUNT a ON t.Account_ID = a.Account_ID AND t.User_ID = a.User_ID
            LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID AND c.User_ID = t.User_ID
            ORDER BY t.Transaction_DateTime DESC, t.Transaction_ID DESC
            LIMIT ?
            `,
            [limit]
        );
        res.json({
            success: true,
            total_in_database: Number(total) || 0,
            returned: txs.length,
            limit,
            transactions: txs
        });
    } catch (err) { sendError(res, err); }
});

// 5.  GET USER NOTIFICATIONS
router.get('/notifications/:userId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, notifications: [] });
        }
        const uid = parseInt(req.params.userId, 10);
        const notifs = await Notification.find({ user_id: uid }).sort({ timestamp: -1 });
        res.json({ success: true, notifications: notifs });
    } catch (err) { sendError(res, err); }
});

// 6. ALL NOTIFICATIONS ADMIN VIEW
router.get('/notifications', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, notifications: [] });
        }
        const notifs = await Notification.find().sort({ timestamp: -1 });
        // Retrieve users payload to append names
        const [users] = await db.query('SELECT User_ID, Name FROM USERS');
        const userMap = users.reduce((acc, u) => { acc[u.User_ID] = u.Name; return acc; }, {});
        
        const enhancedNotifs = notifs.map(n => ({
            ...n.toObject(),
            user_name: userMap[n.user_id] || 'Unknown User'
        }));
        
        res.json({ success: true, notifications: enhancedNotifs });
    } catch (err) { sendError(res, err); }
});

// 6a. GET RESOLVED ALERTS
router.get('/resolved-alerts', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json({ success: true, alerts: [] });
        // Fetch alerts that are of type RESOLVED or status RESOLVED
        const alerts = await Notification.find({ 
            $or: [ { alert_type: 'RESOLVED' }, { alert_status: 'RESOLVED' } ] 
        }).sort({ timestamp: -1 });
        
        const [users] = await db.query('SELECT User_ID, Name FROM USERS');
        const userMap = users.reduce((acc, u) => { acc[u.User_ID] = u.Name; return acc; }, {});
        
        const enhancedAlerts = alerts.map(a => ({
            ...a.toObject(),
            user_name: userMap[a.user_id] || 'Unknown User'
        }));
        
        res.json({ success: true, alerts: enhancedAlerts });
    } catch (err) { sendError(res, err); }
});

// 6b. SEND RESOLVED MESSAGE
router.post('/send-resolved-message', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, error: 'DB not ready' });
        const { user_id } = req.body;
        
        await Notification.create({
            user_id: user_id,
            message: `✅ Admin: Your account risk has been marked as resolved and verified manually.`,
            type: 'MANUAL',
            alert_type: 'RESOLVED',
            alert_status: 'RESOLVED',
            resolved_at: new Date()
        });
        
        res.json({ success: true, message: 'Resolved message sent to user.' });
    } catch (err) { sendError(res, err); }
});

// 6b. DELETE/RESOLVE NOTIFICATION
router.delete('/notifications/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, error: 'Database not ready' });
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Alert marked as resolved/deleted.' });
    } catch (err) { sendError(res, err); }
});

// 7. GET SPECIFIC USER RISK LEVEL
router.get('/risk/:userId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, risk_level: 'LOW', total_spent: 0 });
        }
        const userId = parseInt(req.params.userId);
        const pipeline = [
            { $match: { user_id: userId } },
            STAGE_GROUP_BY_USER,
            STAGE_PROJECT_OUTPUT
        ];

        const [riskData] = await TransactionMongo.aggregate(pipeline);
        res.json({ 
            success: true, 
            risk_level: riskData?.risk_level || 'LOW', 
            total_spent: riskData?.total_spent || 0,
            total_income: riskData?.total_income || 0,
            risk_score: riskData?.risk_score || 0
        });
    } catch (err) { sendError(res, err); }
});

// 8. DELETE USER CASCADING (MySQL & MongoDB)
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        // Delete from all MySQL tables using direct query fallbacks (since ON DELETE CASCADE might not be fully configured)
        const tables = ['EMI', '`TRANSACTION`', 'BUDGET', 'BUDGET_V2', 'FINANCIAL_GOAL', 'ACCOUNT', 'CATEGORY', 'USER_PHONES', 'AUDIT_LOG', 'USERS'];
        for (let table of tables) {
            try {
                const idColumn = table === 'USERS' ? 'User_ID' : table === 'AUDIT_LOG' ? 'Changed_By_User_ID' : 'User_ID';
                await db.query(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [userId]);
            } catch (e) {
                console.log(`Failed to delete from ${table} for user ${userId}`);
            }
        }

        // Delete from MongoDB
        try {
            await TransactionMongo.deleteMany({ user_id: userId });
        } catch (e) {
            console.log(`Failed to delete MongoDB txns for user ${userId}`);
        }

        res.json({ success: true, message: `User ${userId} deleted completely from system` });
    } catch (err) { sendError(res, err); }
});

// 9. FRAUD ADMIN SUMMARY
router.get('/fraud-summary', async (req, res) => {
    try {
        const [[fraudCountRow]] = await db.query("SELECT COUNT(*) as cnt, AVG(fraud_score) as avg_score FROM `TRANSACTION` WHERE fraud_flag = 'FRAUD'");
        const [recentFrauds] = await db.query("SELECT * FROM `TRANSACTION` WHERE fraud_flag = 'FRAUD' ORDER BY Transaction_DateTime DESC LIMIT 10");
        
        res.json({
            success: true,
            total_fraud_count: fraudCountRow.cnt,
            average_fraud_score: fraudCountRow.avg_score || 0,
            recent_frauds: recentFrauds
        });
    } catch (err) { sendError(res, err); }
});

// 10. FRAUD TRANSACTIONS LIST
router.get('/fraud-transactions', async (req, res) => {
    try {
        const [transactions] = await db.query("SELECT * FROM `TRANSACTION` WHERE fraud_flag = 'FRAUD' ORDER BY Transaction_DateTime DESC");
        res.json({ success: true, transactions });
    } catch (err) { sendError(res, err); }
});

module.exports = router;
