const express = require('express');
const router = express.Router();
const db = require('../db');

// Get audit logs for a specific user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Fetch logs where the user performed the action
        // We join with USERS to get the name, although we have the ID.
        // We might also want to show what record was changed.
        const [logs] = await db.query(
            `SELECT 
                a.Log_ID,
                a.Table_Name,
                a.Action_Type,
                a.Record_ID,
                a.Description,
                a.Timestamp,
                u.Name as Changed_By,
                CASE 
                    WHEN a.Table_Name = 'TRANSACTION' THEN (SELECT Description FROM TRANSACTION WHERE Transaction_ID = a.Record_ID)
                    WHEN a.Table_Name = 'BUDGET' THEN (SELECT Category_Name FROM CATEGORY c JOIN BUDGET b ON c.Category_ID = b.Category_ID WHERE b.Budget_ID = a.Record_ID)
                    WHEN a.Table_Name = 'SAVINGS' THEN (SELECT Goal_Title FROM SAVINGS WHERE Goal_ID = a.Record_ID)
                    ELSE NULL
                END as Record_Details
             FROM AUDIT_LOG a
             LEFT JOIN USERS u ON a.Changed_By_User_ID = u.User_ID
             WHERE a.Changed_By_User_ID = ?
             ORDER BY a.Timestamp DESC
             LIMIT 1000`,
            [userId]
        );
        res.json(logs);
    } catch (err) {
        console.error("Error fetching audit logs:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
