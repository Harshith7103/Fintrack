const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fintrack_logs';

const initMongoDB = async () => {
    try {
        // Azure Cosmos DB connection options
        const options = {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        // Add SSL settings for Azure Cosmos DB
        if (MONGO_URI.includes('cosmos.azure.com') || MONGO_URI.includes('ssl=true')) {
            options.ssl = true;
            options.retryWrites = false;  // Cosmos DB compatibility
        }

        await mongoose.connect(MONGO_URI, options);
        
        console.log('✅ Connected to MongoDB successfully.');
        console.log(`   URI: ${MONGO_URI.split('@')[1] || 'localhost'}`);  // Hide credentials in logs
    } catch (err) {
        console.error('❌ Error connecting to MongoDB:', err.message);
    }
};

// 1. FINANCIAL LOG SCHEMA
// For tracking complex nested payload logs (Transactions, AI features, Detailed errors)
const financialLogSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    event_type: { 
        type: String, 
        enum: ['LOGIN', 'TRANSACTION', 'ERROR', 'EMI_DEDUCTION', 'BUDGET_ALERT', 'SYS_MSG'],
        required: true
    },
    details: { type: mongoose.Schema.Types.Mixed }, // Open JSON structure
    timestamp: { type: Date, default: Date.now }
});

const FinancialLog = mongoose.model('FinancialLog', financialLogSchema);

// 2. MONTHLY REPORT SCHEMA
// Archiving dynamic statistics, Top Expenses, Graphs for instantaneous display
const monthlyReportSchema = new mongoose.Schema({
    report_id: { type: String, required: true, unique: true }, // e.g. "rep_2024_02_1"
    user_id: { type: Number, required: true },
    user_name: { type: String, required: true }, // Added for easy viewing in Compass
    month: { type: String, required: true }, // e.g. "2024-02"
    
    // 1. High-Level Summary
    summary: {
        total_income: { type: Number, default: 0 },
        total_expense: { type: Number, default: 0 },
        net_savings: { type: Number, default: 0 },
        savings_rate: { type: Number, default: 0 }
    },

    // 2. Detailed Transactions (Categorized)
    transactions: {
        income: [{ date: Date, amount: Number, category: String, source: String }],
        expenses: [{ date: Date, amount: Number, category: String, description: String }]
    },

    // 3. Budgets (Target vs Actual)
    budgets: [{
        category_name: String,
        allocated_amount: Number,
        spent_amount: Number,
        status: String
    }],

    // 4. Savings Goals Progress
    goals: [{
        goal_title: String,
        target_amount: Number,
        current_amount: Number,
        progress_percentage: Number,
        status: String
    }],

    generated_at: { type: Date, default: Date.now }
});

const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);

// 3. USER PREFERENCES SCHEMA
// Storing UI states, Notification toggles, themes (avoids rigid SQL alterations)
const userPreferenceSchema = new mongoose.Schema({
    user_id: { type: Number, required: true, unique: true },
    theme: { type: String, default: 'dark' },
    notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        budget_alerts: { type: Boolean, default: true }
    },
    dashboard_layout: { type: Array, default: ['balance', 'charts', 'recent'] },
    updated_at: { type: Date, default: Date.now }
});

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

// 4. TRANSACTION REPLICA (For Admin Pipeline) — mirrors MySQL TRANSACTION for all users / history
const transactionSchema = new mongoose.Schema({
    transaction_id: { type: Number, required: true, unique: true },
    user_id: { type: Number, required: true },
    account_id: { type: Number },
    category_id: { type: Number },
    amount: { type: Number, required: true },
    status: { type: String, default: 'SUCCESS' },
    date: { type: Date, default: Date.now },
    type: { type: String, required: true },
    reference_type: { type: String, default: 'Manual' },
    description: { type: String, default: '' }
});

const TransactionMongo = mongoose.model('Transaction', transactionSchema);

// 5. NOTIFICATIONS (For Admin Alerts)
const notificationSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['AUTOMATED', 'MANUAL'], default: 'AUTOMATED' },
    alert_type: { type: String, enum: ['WARNING', 'RESOLVED', 'FRAUD'], default: 'WARNING' },
    alert_status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
    details: { type: mongoose.Schema.Types.Mixed }, // Store reasons or txn specifics
    timestamp: { type: Date, default: Date.now },
    resolved_at: { type: Date },
    is_read: { type: Boolean, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

// 6. ADMIN LOGS
const adminLogSchema = new mongoose.Schema({
    admin_id: { type: Number, required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const AdminLog = mongoose.model('AdminLog', adminLogSchema);

module.exports = {
    initMongoDB,
    FinancialLog,
    MonthlyReport,
    UserPreference,
    TransactionMongo,
    Notification,
    AdminLog
};
