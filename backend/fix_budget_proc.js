const db = require('./db');

const fixBudgetProc = async () => {
    try {
        await db.query(`DROP PROCEDURE IF EXISTS sp_get_budget_status`);
        await db.query(`
            CREATE PROCEDURE sp_get_budget_status(
                IN p_User_ID INT,
                IN p_Month_Year VARCHAR(7)
            )
            BEGIN
                SELECT 
                    b.Budget_ID,
                    b.Category_ID,
                    c.Category_Name, 
                    b.Budget_Amount, 
                    b.Month_Year,
                    COALESCE(cs.Total_Amount, 0) AS Actual_Spending,
                    (b.Budget_Amount - COALESCE(cs.Total_Amount, 0)) AS Remaining
                FROM BUDGET b
                JOIN CATEGORY c ON b.Category_ID = c.Category_ID
                LEFT JOIN CATEGORY_SUMMARY cs ON cs.User_ID = b.User_ID 
                     AND cs.Category_ID = b.Category_ID 
                     AND cs.Month_Year = b.Month_Year
                WHERE b.User_ID = p_User_ID AND b.Month_Year = p_Month_Year
                ORDER BY c.Category_Name;
            END
        `);
        console.log('Fixed SP!');
    } catch(e){
        console.error(e);
    } finally {
        process.exit();
    }
}
fixBudgetProc();
