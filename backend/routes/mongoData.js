const express = require('express');
const router  = express.Router();
const { FinancialLog, MonthlyReport, UserPreference } = require('../mongodb');
const db = require('../db');

// ─────────────────────────────────────────────────────────────
//  HELPER – central error formatter keeps all responses uniform
// ─────────────────────────────────────────────────────────────
function sendError(res, err, code = 500) {
    console.error('[MongoDB Route Error]', err.message || err);
    return res.status(code).json({ success: false, error: err.message || 'Unexpected error' });
}

function validateUserId(req, res) {
    const id = parseInt(req.params.userId || req.body?.user_id);
    if (!id || isNaN(id)) {
        sendError(res, new Error('Valid numeric user_id is required'), 400);
        return null;
    }
    return id;
}

// ═════════════════════════════════════════════════════════════
//  1.  USER PREFERENCES  (Full CRUD)
// ═════════════════════════════════════════════════════════════

// READ preferences
router.get('/preferences/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const prefs = await UserPreference.findOne({ user_id: userId });
        res.json({ success: true, data: prefs || {} });
    } catch (err) { sendError(res, err); }
});

// CREATE / UPDATE preferences
router.post('/preferences', async (req, res) => {
    try {
        const { user_id, theme, notifications, dashboard_layout } = req.body;
        if (!user_id) return sendError(res, new Error('user_id is required'), 400);

        const prefs = await UserPreference.findOneAndUpdate(
            { user_id },
            { $set: { theme, notifications, dashboard_layout, updated_at: new Date() } },
            { new: true, upsert: true }
        );
        res.json({ success: true, message: 'Preferences saved', data: prefs });
    } catch (err) { sendError(res, err); }
});

// DELETE preferences
router.delete('/preferences/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        await UserPreference.findOneAndDelete({ user_id: userId });
        res.json({ success: true, message: 'Preferences deleted' });
    } catch (err) { sendError(res, err); }
});

// ═════════════════════════════════════════════════════════════
//  2.  MONTHLY REPORTS  (Full CRUD + $match/$group/$project)
// ═════════════════════════════════════════════════════════════

// GENERATE (upsert) a full report for a user – syncs from MySQL
router.post('/reports/generate', async (req, res) => {
    try {
        const { user_id, month_year } = req.body;
        if (!user_id || !month_year)
            return sendError(res, new Error('user_id and month_year are required'), 400);

        const { syncProjectData } = require('../utils/syncHelper');
        await syncProjectData(user_id, month_year);

        const reportId = `real_rep_${month_year.replace('-', '_')}_u${user_id}`;
        const report   = await MonthlyReport.findOne({ report_id: reportId });

        if (!report) return sendError(res, new Error('Report could not be generated – check MySQL data'), 404);

        res.json({ success: true, message: 'Report generated and saved to MongoDB', data: report });
    } catch (err) { sendError(res, err); }
});

// READ all reports for a user
router.get('/reports/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const reports = await MonthlyReport.find({ user_id: userId }).sort({ month: -1 });
        res.json({ success: true, count: reports.length, data: reports });
    } catch (err) { sendError(res, err); }
});

// READ single report
router.get('/reports/detail/:reportId', async (req, res) => {
    try {
        const report = await MonthlyReport.findOne({ report_id: req.params.reportId });
        if (!report) return sendError(res, new Error('Report not found'), 404);
        res.json({ success: true, data: report });
    } catch (err) { sendError(res, err); }
});

// DELETE a report
router.delete('/reports/:reportId', async (req, res) => {
    try {
        const result = await MonthlyReport.findOneAndDelete({ report_id: req.params.reportId });
        if (!result) return sendError(res, new Error('Report not found'), 404);
        res.json({ success: true, message: 'Report deleted from MongoDB' });
    } catch (err) { sendError(res, err); }
});

// ═════════════════════════════════════════════════════════════
//  3.  FINANCIAL LOGS – AUDIT TRAIL  (CRUD)
// ═════════════════════════════════════════════════════════════

// READ audit logs (newest first, limit 100)
router.get('/alerts/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const { event_type, limit = 100 } = req.query;
        const filter = { user_id: userId };
        if (event_type) filter.event_type = event_type; // optional query-filter

        const logs = await FinancialLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, count: logs.length, data: logs });
    } catch (err) { sendError(res, err); }
});

// CREATE a manual audit log entry
router.post('/alerts', async (req, res) => {
    try {
        const { user_id, event_type, details } = req.body;
        if (!user_id || !event_type)
            return sendError(res, new Error('user_id and event_type are required'), 400);

        const allowed = ['LOGIN', 'TRANSACTION', 'ERROR', 'EMI_DEDUCTION', 'BUDGET_ALERT', 'SYS_MSG'];
        if (!allowed.includes(event_type))
            return sendError(res, new Error(`event_type must be one of: ${allowed.join(', ')}`), 400);

        const log = await FinancialLog.create({ user_id, event_type, details, timestamp: new Date() });
        res.status(201).json({ success: true, message: 'Log entry created', data: log });
    } catch (err) { sendError(res, err); }
});

// DELETE a single audit log
router.delete('/alerts/:logId', async (req, res) => {
    try {
        const result = await FinancialLog.findByIdAndDelete(req.params.logId);
        if (!result) return sendError(res, new Error('Log entry not found'), 404);
        res.json({ success: true, message: 'Log entry deleted' });
    } catch (err) { sendError(res, err); }
});

// ═════════════════════════════════════════════════════════════
//  4.  AGGREGATION PIPELINE ENDPOINTS
//      Each one demonstrates $match + $group + $project
// ═════════════════════════════════════════════════════════════

// 4a. Event-type summary for audit logs
//     Pipeline: $match → $group → $project → $sort
router.get('/stats/summary/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const stats = await FinancialLog.aggregate([
            // STAGE 1 – filter to this user's logs only
            { $match: { user_id: userId } },
            // STAGE 2 – group by event type, count and sum amounts
            {
                $group: {
                    _id:          '$event_type',
                    count:        { $sum: 1 },
                    total_amount: { $sum: '$details.amount' },
                    last_seen:    { $max: '$timestamp' }
                }
            },
            // STAGE 3 – reshape the output
            {
                $project: {
                    _id:          0,
                    event_type:   '$_id',
                    count:        1,
                    total_amount: { $round: ['$total_amount', 2] },
                    last_seen:    1
                }
            },
            // STAGE 4 – order by frequency descending
            { $sort: { count: -1 } }
        ]);

        res.json({ success: true, pipeline: '$match→$group→$project→$sort', data: stats });
    } catch (err) { sendError(res, err); }
});

// 4b. Monthly income vs expense summary from MonthlyReport collection
//     Pipeline: $match → $group → $project → $sort
router.get('/stats/monthly/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const stats = await MonthlyReport.aggregate([
            // STAGE 1 – only this user's reports
            { $match: { user_id: userId } },
            // STAGE 2 – one doc per month, sum income/expense
            {
                $group: {
                    _id:           '$month',
                    total_income:  { $sum: '$summary.total_income' },
                    total_expense: { $sum: '$summary.total_expense' },
                    net_savings:   { $sum: '$summary.net_savings' },
                    closing_bal:   { $avg: '$summary.closing_balance' }
                }
            },
            // STAGE 3 – clean field names, round values
            {
                $project: {
                    _id:          0,
                    month:        '$_id',
                    total_income: { $round: ['$total_income',  2] },
                    total_expense:{ $round: ['$total_expense', 2] },
                    net_savings:  { $round: ['$net_savings',   2] },
                    closing_bal:  { $round: ['$closing_bal',   2] }
                }
            },
            { $sort: { month: -1 } }
        ]);

        res.json({ success: true, pipeline: '$match→$group→$project→$sort', data: stats });
    } catch (err) { sendError(res, err); }
});

// 4c. Budget utilisation breakdown from MonthlyReport embedded array
//     Pipeline: $match → $unwind → $group → $project → $sort
router.get('/stats/budgets/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const stats = await MonthlyReport.aggregate([
            // STAGE 1 – this user only
            { $match: { user_id: userId } },
            // STAGE 2 – flatten the embedded budgets array
            { $unwind: '$budgets' },
            // STAGE 3 – group by budget category, sum across months
            {
                $group: {
                    _id:             '$budgets.category_name',
                    total_allocated: { $sum: '$budgets.allocated_amount' },
                    total_spent:     { $sum: '$budgets.spent_amount' }
                }
            },
            // STAGE 4 – compute utilisation % and rename fields
            {
                $project: {
                    _id:             0,
                    category:        '$_id',
                    total_allocated: { $round: ['$total_allocated', 2] },
                    total_spent:     { $round: ['$total_spent',     2] },
                    utilisation_pct: {
                        $round: [{
                            $multiply: [
                                { $divide: ['$total_spent', { $ifNull: ['$total_allocated', 1] }] },
                                100
                            ]
                        }, 2]
                    }
                }
            },
            { $sort: { total_spent: -1 } }
        ]);

        res.json({ success: true, pipeline: '$match→$unwind→$group→$project→$sort', data: stats });
    } catch (err) { sendError(res, err); }
});

// 4d. Goals progress summary
//     Pipeline: $match → $unwind → $addFields → $group → $project
router.get('/stats/goals/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const stats = await MonthlyReport.aggregate([
            // STAGE 1
            { $match: { user_id: userId } },
            // STAGE 2 – flatten embedded goals
            { $unwind: '$goals' },
            // STAGE 3 – add computed achieved flag
            {
                $addFields: {
                    'goals.achieved': {
                        $cond: [{ $gte: ['$goals.current_amount', '$goals.target_amount'] }, true, false]
                    }
                }
            },
            // STAGE 4 – group by goal title
            {
                $group: {
                    _id:            '$goals.goal_title',
                    target:         { $max: '$goals.target_amount' },
                    saved:          { $max: '$goals.current_amount' },
                    progress_pct:   { $max: { $toDouble: '$goals.progress_percentage' } },
                    achieved:       { $max: '$goals.achieved' }
                }
            },
            // STAGE 5 – final shape
            {
                $project: {
                    _id:          0,
                    goal_title:   '$_id',
                    target:       { $round: ['$target', 2] },
                    saved:        { $round: ['$saved',  2] },
                    remaining:    { $round: [{ $subtract: ['$target', '$saved'] }, 2] },
                    progress_pct: { $round: ['$progress_pct', 2] },
                    achieved:     1
                }
            },
            { $sort: { progress_pct: -1 } }
        ]);

        res.json({ success: true, pipeline: '$match→$unwind→$addFields→$group→$project', data: stats });
    } catch (err) { sendError(res, err); }
});

// 4e. Transaction category breakdown – uses $match, $unwind, $group, $project, $facet
//     $facet lets us return BOTH the detail list AND totals in one pipeline call
router.get('/stats/transactions/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const { month } = req.query; // optional ?month=2026-03

        const matchStage = { user_id: userId };
        if (month) matchStage.month = month;

        const stats = await MonthlyReport.aggregate([
            // STAGE 1 – filter
            { $match: matchStage },
            // STAGE 2 – unwind income array
            {
                $facet: {
                    income_breakdown: [
                        { $unwind: '$transactions.income' },
                        {
                            $group: {
                                _id:   '$transactions.income.category',
                                total: { $sum: '$transactions.income.amount' },
                                count: { $sum: 1 }
                            }
                        },
                        { $project: { _id: 0, category: '$_id', total: { $round: ['$total', 2] }, count: 1 } },
                        { $sort: { total: -1 } }
                    ],
                    expense_breakdown: [
                        { $unwind: '$transactions.expenses' },
                        {
                            $group: {
                                _id:   '$transactions.expenses.category',
                                total: { $sum: '$transactions.expenses.amount' },
                                count: { $sum: 1 }
                            }
                        },
                        { $project: { _id: 0, category: '$_id', total: { $round: ['$total', 2] }, count: 1 } },
                        { $sort: { total: -1 } }
                    ],
                    summary: [
                        {
                            $group: {
                                _id:           null,
                                total_income:  { $sum: '$summary.total_income' },
                                total_expense: { $sum: '$summary.total_expense' },
                                net:           { $sum: '$summary.net_savings' }
                            }
                        },
                        {
                            $project: {
                                _id:           0,
                                total_income:  { $round: ['$total_income',  2] },
                                total_expense: { $round: ['$total_expense', 2] },
                                net_savings:   { $round: ['$net',           2] }
                            }
                        }
                    ]
                }
            }
        ]);

        res.json({
            success:  true,
            pipeline: '$match→$facet[$unwind→$group→$project→$sort]',
            data:     stats[0] || {}
        });
    } catch (err) { sendError(res, err); }
});

// 4f.  Net-worth trend over time (closing_balance per month)
//      Pipeline: $match → $project → $sort
router.get('/stats/networth/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const trend = await MonthlyReport.aggregate([
            { $match: { user_id: userId } },
            {
                $project: {
                    _id:            0,
                    month:          1,
                    net_worth:      { $round: ['$summary.closing_balance', 2] },
                    total_income:   { $round: ['$summary.total_income',    2] },
                    total_expense:  { $round: ['$summary.total_expense',   2] },
                    net_savings:    { $round: ['$summary.net_savings',     2] }
                }
            },
            { $sort: { month: 1 } }
        ]);

        res.json({ success: true, pipeline: '$match→$project→$sort', data: trend });
    } catch (err) { sendError(res, err); }
});

// ═════════════════════════════════════════════════════════════
//  5.  SYNC ENDPOINT – force-mirror a user's data to MongoDB
// ═════════════════════════════════════════════════════════════
router.post('/sync/:userId', async (req, res) => {
    try {
        const userId = validateUserId(req, res);
        if (!userId) return;

        const { syncProjectData } = require('../utils/syncHelper');
        await syncProjectData(userId);
        res.json({ success: true, message: `User ${userId} fully synced to MongoDB` });
    } catch (err) { sendError(res, err); }
});

module.exports = router;
