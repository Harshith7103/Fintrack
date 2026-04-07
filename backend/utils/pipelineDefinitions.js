/**
 * Shared MongoDB aggregation stages for admin demos.
 * Advanced Risk Analysis System:
 * Instead of a fixed 50k threshold, we analyze the Risk Score based on Expense-to-Income Ratio.
 * 
 * Logic:
 * Risk = (Total Expenses / Total Income) * 100
 * - Risk Score > 90%  => HIGH (Living on the edge)
 * - Risk Score 70-90% => MEDIUM (Warning)
 * - Risk Score < 70%  => LOW (Healthy)
 */

/** Stage 1: include all transactions for all users */
const STAGE_MATCH_ALL = { $match: {} };

/** Stage 2: one row per user_id across the entire collection */
const STAGE_GROUP_BY_USER = {
    $group: {
        _id: '$user_id',
        total_spent: { 
            $sum: { 
                $cond: [{ $eq: ["$type", "Expense"] }, "$amount", 0] 
            } 
        },
        total_income: { 
            $sum: { 
                $cond: [{ $eq: ["$type", "Income"] }, "$amount", 0] 
            } 
        },
        transaction_count: { $sum: 1 },
        avg_amount: { $avg: '$amount' },
    },
};

/**
 * Stage 3: final projection shape (clean output document per user)
 * Calculates the Risk Score dynamically based on user's financial capacity.
 */
const STAGE_PROJECT_OUTPUT = {
    $project: {
        _id: 0,
        user_id: '$_id',
        total_spent: 1,
        total_income: 1,
        transaction_count: 1,
        avg_amount: { $round: ['$avg_amount', 2] },
        // Risk Score = (Expenses / Income) * 100 (Handled divide by zero with $ifNull)
        risk_score: {
            $round: [
                { 
                    $multiply: [
                        { $divide: ["$total_spent", { $cond: [{ $eq: ["$total_income", 0] }, 1, "$total_income"] }] },
                        100
                    ]
                }, 
                2
            ]
        },
        risk_level: {
            $switch: {
                branches: [
                    { case: { $gte: [{ $divide: ["$total_spent", { $cond: [{ $eq: ["$total_income", 0] }, 1, "$total_income"] }] }, 0.9] }, then: "HIGH" },
                    { case: { $gte: [{ $divide: ["$total_spent", { $cond: [{ $eq: ["$total_income", 0] }, 1, "$total_income"] }] }, 0.7] }, then: "MEDIUM" }
                ],
                default: "LOW"
            }
        }
    },
};

/** Documentation only — fields you see after $project */
const PROJECTION_OUTPUT_SHAPE = {
    user_id: 'number (all users)',
    total_spent: 'number (Expenses only)',
    total_income: 'number',
    risk_score: 'percentage of income spent',
    risk_level: '"HIGH" | "MEDIUM" | "LOW"',
};

function chainDescription(stages) {
    return stages.join(' → ');
}

module.exports = {
    STAGE_MATCH_ALL,
    STAGE_GROUP_BY_USER,
    STAGE_PROJECT_OUTPUT,
    PROJECTION_OUTPUT_SHAPE,
    chainDescription,
};
