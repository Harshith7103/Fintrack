const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncProjectData } = require('../utils/syncHelper');

// Get all budgets for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { month_year } = req.query;

    let query = `
        SELECT b.*, c.Category_Name, c.Category_Type
        FROM BUDGET b
        JOIN CATEGORY c ON b.Category_ID = c.Category_ID
        WHERE b.User_ID = ?
    `;

    const params = [userId];
    if (month_year) {
        query += ' AND b.Month_Year = ?';
        params.push(month_year);
    }

    try {
        const [budgets] = await db.query(query, params);
        
        // --- AUTO-SYNC ---
        syncProjectData(userId).catch(e => console.error('Budget Sync Error:', e.message));

        res.json(budgets);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create or update budget
router.post('/', async (req, res) => {
    const { user_id, category_id, budget_amount, month_year } = req.body;
    if (!user_id || !category_id || !budget_amount || !month_year) return res.status(400).json({ error: 'Missing required fields' });

    try {
        await db.query('CALL sp_create_or_update_budget(?, ?, ?, ?)', [user_id, category_id, budget_amount, month_year]);

        // --- REAL-TIME SYNC ---
        syncProjectData(user_id).catch(e => console.error('Budget Sync Error:', e.message));

        res.json({ message: 'Budget saved successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete budget
router.delete('/:budgetId', async (req, res) => {
    const { budgetId } = req.params;
    try {
        const [rows] = await db.query('SELECT User_ID FROM BUDGET WHERE Budget_ID = ?', [budgetId]);
        if (rows[0]) {
            await db.execute('DELETE FROM BUDGET WHERE Budget_ID = ?', [budgetId]);
            syncProjectData(rows[0].User_ID).catch(e => console.error('Budget Sync Error:', e.message));
        }
        res.json({ message: 'Budget deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
