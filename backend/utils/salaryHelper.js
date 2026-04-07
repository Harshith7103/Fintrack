const db = require('../db');

const checkAndProcessSalary = async (userId) => {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    
    try {
        // Get user's current Monthly_Income
        const [users] = await db.query('SELECT Monthly_Income FROM USERS WHERE User_ID = ?', [userId]);
        if (!users || users.length === 0) return;
        
        const monthlyIncome = parseFloat(users[0].Monthly_Income || 0);
        if (monthlyIncome <= 0) return; // No salary to add

        // Check if salary was already credited this month
        const [transactions] = await db.query(
            `SELECT COUNT(*) as count FROM \`TRANSACTION\` 
             WHERE User_ID = ? AND Transaction_Type = 'Income' 
             AND Description = 'Auto-Salary Credit'
             AND DATE_FORMAT(Transaction_DateTime, '%Y-%m') = ?`,
            [userId, currentMonthStr]
        );

        if (transactions[0].count === 0) {
            console.log(`Auto-crediting salary for User ${userId}`);

            // Find an account to add to (or create one)
            let accountId;
            const [accounts] = await db.query(
                'SELECT Account_ID FROM ACCOUNT WHERE User_ID = ? ORDER BY CASE WHEN Account_Type = "Bank" THEN 1 ELSE 2 END LIMIT 1',
                [userId]
            );

            if (accounts.length > 0) {
                accountId = accounts[0].Account_ID;
            } else {
                // Create default Cash account
                const [newAcc] = await db.execute(
                    'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)',
                    [userId, 'Cash Wallet', 'Cash', 0]
                );
                accountId = newAcc.insertId;
            }

            // Insert Salary Transaction
            await db.execute(
                `INSERT INTO \`TRANSACTION\` 
                (User_ID, Account_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime) 
                VALUES (?, ?, ?, 'Income', 'Manual', 'Auto-Salary Credit', NOW())`,
                [userId, accountId, monthlyIncome]
            );
            
            console.log(`Successfully credited salary: ₹${monthlyIncome}`);
        }
    } catch (err) {
        console.error("Error in checkAndProcessSalary:", err);
    }
};

module.exports = { checkAndProcessSalary };
