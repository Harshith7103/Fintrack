const mongoose = require('mongoose');
const db = require('./backend/db');

require('dotenv').config();

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/fintrack_logs');
        console.log('Connected to MongoDB manually.');

        const schema = new mongoose.Schema({}, { strict: false });
        const MonthlyReport = mongoose.model('MonthlyReport', schema);

        const [users] = await db.query('SELECT User_ID, Name FROM USERS');
        for (const user of users) {
             const userId = user.User_ID;
             const userName = user.Name;
             const currentMonth = new Date().toISOString().substring(0, 7);
             const reportId = `real_rep_${currentMonth.replace('-', '_')}_u${userId}`;

             // 1. Fetch Transactions
             const [txs] = await db.query(`
                 SELECT t.*, c.Category_Name 
                 FROM \`TRANSACTION\` t
                 LEFT JOIN CATEGORY c ON t.Category_ID = c.Category_ID
                 WHERE t.User_ID = ? AND DATE_FORMAT(t.Transaction_DateTime, '%Y-%m') = ?
             `, [userId, currentMonth]);

             const income = [];
             const expenses = [];
             let totalInc = 0;
             let totalExp = 0;

             txs.forEach(t => {
                 const row = { date: t.Transaction_DateTime, amount: parseFloat(t.Amount), category: t.Category_Name || 'System', description: t.Description || '' };
                 if (t.Transaction_Type === 'Income') {
                     income.push(row);
                     totalInc += row.amount;
                 } else {
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
             `, [userId, currentMonth]);

             // 3. Fetch Event Budgets
             const [eventBudgets] = await db.query(`
                 SELECT * FROM BUDGET_V2 
                 WHERE User_ID = ? AND Status != 'Deleted'
             `, [userId]);

             const finalBudgets = [
                 ...regBudgets.map(b => ({ category_name: b.Category_Name, allocated_amount: parseFloat(b.Budget_Amount), spent_amount: 0, status: 'Active' })),
                 ...eventBudgets.map(e => ({ 
                     category_name: `Event: ${e.Budget_Name}`, 
                     allocated_amount: parseFloat(e.Total_Budget_Amount), 
                     spent_amount: parseFloat(e.Total_Budget_Amount - e.Remaining_Budget_Amount), 
                     status: e.Status 
                 }))
             ];

             // 4. Fetch Goals
             const [goals] = await db.query('SELECT * FROM SAVINGS WHERE User_ID = ?', [userId]);

             // 5. Net Worth
             const [accRows] = await db.query('SELECT SUM(Balance) as Net_Worth FROM ACCOUNT WHERE User_ID = ?', [userId]);
             const netWorth = parseFloat(accRows[0]?.Net_Worth || 0);

             // UPDATE MONGODB
             await MonthlyReport.findOneAndUpdate(
                 { report_id: reportId },
                 { 
                     $set: {
                         user_id: userId,
                         user_name: userName,
                         month: currentMonth,
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
                     }
                 },
                 { upsert: true }
             );
        }

        console.log('🎉 Successfully force-synced all users directly to MongoDB!');
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e);
        process.exit(1);
    }
})();
