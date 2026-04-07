const db = require('./backend/db');

async function test() {
    try {
        const [eventBudgets] = await db.query(`SELECT * FROM BUDGET_V2 WHERE User_ID = 25 AND Status != 'Deleted'`);
        console.log('EVENT COUNT:', eventBudgets.length);
        const finalBudgets = [
            ...eventBudgets.map(e => ({
                category_name: 'Event: '+e.Budget_Name,
                allocated_amount: parseFloat(e.Total_Budget_Amount),
                spent_amount: parseFloat(e.Total_Budget_Amount - e.Remaining_Budget_Amount),
                status: e.Status
            }))
        ];
        console.log('FINAL:', finalBudgets);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
