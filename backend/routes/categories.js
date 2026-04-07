const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all categories for a user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [categories] = await db.query(
            'SELECT * FROM CATEGORY WHERE User_ID = ? ORDER BY Category_Name',
            [userId]
        );
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new category
router.post('/', async (req, res) => {
    const { user_id, category_name, category_type } = req.body;

    if (!user_id || !category_name || !category_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)',
            [user_id, category_name, category_type]
        );
        res.json({
            message: 'Category created successfully',
            category_id: result.insertId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update category
router.put('/:categoryId', async (req, res) => {
    const { categoryId } = req.params;
    const { category_name, category_type } = req.body;

    try {
        await db.execute(
            'UPDATE CATEGORY SET Category_Name = ?, Category_Type = ? WHERE Category_ID = ?',
            [category_name, category_type, categoryId]
        );
        res.json({ message: 'Category updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete category
router.delete('/:categoryId', async (req, res) => {
    const { categoryId } = req.params;

    try {
        await db.execute('DELETE FROM CATEGORY WHERE Category_ID = ?', [categoryId]);
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
