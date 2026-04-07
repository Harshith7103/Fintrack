const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fintrack_logs';

const monthlyReportSchema = new mongoose.Schema({
    report_id: { type: String, unique: true },
    user_id: Number,
    user_name: String,
    month: String,
    summary: Object,
    transactions: {
        income: Array,
        expenses: Array
    },
    budgets: Array,
    goals: Array,
    generated_at: { type: Date, default: Date.now }
});

const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // Wipe old placeholder data
        await MonthlyReport.deleteMany({});

        // REAL USERS FROM PROJECT (Pulled from MySQL)
        const projectUsers = [
            { id: 23, name: 'Pooja Valleti', role: 'Main User' },
            { id: 26, name: 'Raja Verma', role: 'Employee' },
            { id: 27, name: 'ramesh', role: 'Regular User' },
            { id: 4, name: 'Verifier', role: 'Admin' }
        ];

        for (const user of projectUsers) {
            console.log(`Seeding Bank Statement for REAL User: ${user.name}...`);
            const incomeAmt = 90000 + (user.id * 500);
            const expenseAmt = 35000 + (user.id * 200);

            await MonthlyReport.create({
                report_id: `rep_2024_03_u${user.id}`,
                user_id: user.id,
                user_name: user.name,
                month: '2024-03',
                summary: {
                    total_income: incomeAmt,
                    total_expense: expenseAmt,
                    net_savings: incomeAmt - expenseAmt,
                    savings_rate: ((incomeAmt - expenseAmt) / incomeAmt * 100).toFixed(2),
                    closing_balance: 50000 + (user.id * 100)
                },
                transactions: {
                    income: [
                         { date: '2024-03-01', amount: incomeAmt - 10000, category: 'Salary', source: 'Direct Deposit', description: `Final Salary - ${user.name}` },
                         { date: '2024-03-15', amount: 10000, category: 'Incentive', source: 'Internal Reward', description: 'Internal Project Reward' }
                    ],
                    expenses: [
                        { date: '2024-03-02', amount: 12000, category: 'Housing', description: 'Monthly Rent Apartment' },
                        { date: '2024-03-05', amount: 3500, category: 'Grocery', description: 'BigBasket Stock' },
                        { date: '2024-03-10', amount: 2000, category: 'Utility', description: 'Monthly Electricity Bill' },
                        { date: '2024-03-15', amount: 4500, category: 'Dining', description: 'Family Dinner Outing' },
                        { date: '2024-03-20', amount: 8000, category: 'Invest', description: 'Mutual Fund SIP' },
                        { date: '2024-03-25', amount: 1500, category: 'Travel', description: 'Fuel Refill HP' }
                    ]
                },
                budgets: [
                    { category_name: 'Food', allocated_amount: 8000, spent_amount: 4500, status: 'Under Budget' },
                    { category_name: 'Shopping', allocated_amount: 5000, spent_amount: 7000, status: 'Over Budget' }
                ],
                goals: [
                    { goal_title: 'Dream Project Savings', target_amount: 300000, current_amount: 120000, progress_percentage: 40, status: 'Active' }
                ],
                generated_at: new Date()
            });
        }

        console.log('✅ BANK STATEMENTS GENERATED FOR YOUR REAL USERS (Pooja, Raja, Ramesh, Verifier)!');
        process.exit(0);
    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
}

seed();
