const express = require('express');
const router = express.Router();
const { TransactionMongo, Notification } = require('../mongodb');
const { refreshMongoTransactionsForAdmin, attachUserNames } = require('../utils/adminPipelineHelper');
const {
    STAGE_MATCH_ALL,
    STAGE_GROUP_BY_USER,
    STAGE_PROJECT_OUTPUT,
    PROJECTION_OUTPUT_SHAPE,
    chainDescription,
} = require('../utils/pipelineDefinitions');

const sendError = (res, err, status = 500) =>
    res.status(status).json({ success: false, error: err.message });

/** Create one notification per HIGH-risk user (deduped by same message). */
async function insertHighRiskNotifications(rows) {
    let created = 0;
    for (const record of rows) {
        if (record.risk_level !== 'HIGH') continue;
        const uid = record.user_id;
        if (uid == null) continue;
        const message = `⚠️ High spending alert: ₹${Number(record.total_spent).toLocaleString()} detected. Review your transactions immediately.`;
        const exists = await Notification.findOne({ user_id: uid, message });
        if (!exists) {
            await Notification.create({ user_id: uid, message });
            created += 1;
        }
    }
    return created;
}

// GET /api/match
router.get('/match', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, { $sort: { user_id: 1, transaction_id: 1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);
        res.json({
            success: true,
            stage: '$match',
            query: '{ $match: {} }',
            description: 'All documents, all users — empty filter matches the whole collection.',
            pipeline_chain: ['$match: {}'],
            count: data.length,
            data,
        });
    } catch (err) {
        sendError(res, err);
    }
});

// GET /api/group
router.get('/group', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, { $sort: { _id: 1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r._id);
        res.json({
            success: true,
            stage: '$group',
            query: '{ $match: {} }, { $group: { _id: "$user_id", total_spent, transaction_count, avg_amount } }',
            description: chainDescription(['$match: {}', '$group by user_id']),
            pipeline_chain: ['$match: {}', '$group'],
            count: data.length,
            data,
        });
    } catch (err) {
        sendError(res, err);
    }
});

// GET /api/project
router.get('/project', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, STAGE_PROJECT_OUTPUT, { $sort: { user_id: 1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);
        res.json({
            success: true,
            stage: '$project',
            query: '{ $match: {} }, { $group }, { $project: final shape + risk }',
            description: chainDescription(['$match: {}', '$group', '$project (output shape)']),
            projection_output_shape: PROJECTION_OUTPUT_SHAPE,
            pipeline_chain: ['$match: {}', '$group', '$project'],
            count: data.length,
            data,
        });
    } catch (err) {
        sendError(res, err);
    }
});

// GET /api/sort
router.get('/sort', async (req, res) => {
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
            description: chainDescription(['$match → $group → $project', '$sort by total_spent']),
            projection_output_shape: PROJECTION_OUTPUT_SHAPE,
            pipeline_chain: ['$match: {}', '$group', '$project', '$sort'],
            count: data.length,
            data,
        });
    } catch (err) {
        sendError(res, err);
    }
});

// GET /api/fullPipeline
router.get('/fullPipeline', async (req, res) => {
    try {
        if (!(await refreshMongoTransactionsForAdmin(res))) return;
        const pipeline = [STAGE_MATCH_ALL, STAGE_GROUP_BY_USER, STAGE_PROJECT_OUTPUT, { $sort: { total_spent: -1 } }];
        let data = await TransactionMongo.aggregate(pipeline);
        data = await attachUserNames(data, (r) => r.user_id);
        const alerts_generated = await insertHighRiskNotifications(data);
        res.json({
            success: true,
            stage: 'Full Pipeline ($match → $group → $project → $sort)',
            query: '{ $match: {} }, { $group }, { $project }, { $sort }',
            description: chainDescription([
                '$match: {} (all users)',
                '$group',
                '$project (final shape)',
                '$sort + HIGH-risk notifications',
            ]),
            projection_output_shape: PROJECTION_OUTPUT_SHAPE,
            pipeline_chain: ['$match: {}', '$group', '$project', '$sort'],
            count: data.length,
            alerts_generated,
            data,
        });
    } catch (err) {
        sendError(res, err);
    }
});

module.exports = router;
