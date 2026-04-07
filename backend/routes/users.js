const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// Get All Users
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM USERS");

        // Fetch phones for all users
        const [phones] = await db.query("SELECT * FROM USER_PHONES");

        // Attach phones to users
        const users = rows.map(user => {
            const userPhones = phones.filter(p => p.User_ID === user.User_ID)
                .sort((a, b) => (b.Is_Primary - a.Is_Primary) || (a.Phone_ID - b.Phone_ID))
                .map(p => p.Phone_No);
            const { Password, ...userData } = user;
            userData.Phone_No = userPhones;
            return userData;
        });

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Password
router.post('/update-password', async (req, res) => {
    const { user_id, newPassword } = req.body;
    if (!user_id || !newPassword) {
        return res.status(400).json({ success: false, error: 'User ID and new password are required' });
    }

    try {
        const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
        const [result] = await db.execute('UPDATE USERS SET Password = ? WHERE User_ID = ?', [hashedPassword, user_id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User ID not found' });
        }

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error("[PASS_RESET_ERROR]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create User (Admin or generic create)
router.post('/', async (req, res) => {
    const { name, email, phone, address, occupation, monthly_income } = req.body;
    // Note: Password is not handled here? This seems to be a raw create. 
    // Usually auth/register is used. This might be for admin.
    // We will leave password null or require it if schema requires it. 
    // Schema says Password is NOT NULL. So this route would fail if password not provided.
    // I won't fix the password issue unless asked, but I will fix phone.

    const sql = `INSERT INTO USERS (Name, Email, Address, Occupation, Monthly_Income) VALUES (?, ?, ?, ?, ?)`;

    try {
        const [result] = await db.execute(sql, [name, email, address, occupation, monthly_income]);
        const userId = result.insertId;

        if (phone) {
            const phones = Array.isArray(phone) ? phone : [phone];
            const validPhones = phones.filter(p => p && p.trim().length > 0);
            if (validPhones.length > 0) {
                const phoneValues = validPhones.map((p, index) => [userId, p, index === 0]);
                await db.query("INSERT INTO USER_PHONES (User_ID, Phone_No, Is_Primary) VALUES ?", [phoneValues]);
            }
        }

        res.json({ id: userId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile
router.put('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { Name, Phone_No, Address, Occupation, Monthly_Income } = req.body;

    const sql = `UPDATE USERS SET 
                 Name = COALESCE(?, Name), 
                 Address = COALESCE(?, Address), 
                 Occupation = COALESCE(?, Occupation), 
                 Monthly_Income = COALESCE(?, Monthly_Income) 
                 WHERE User_ID = ?`;

    try {
        const [result] = await db.execute(sql, [Name, Address, Occupation, Monthly_Income, userId]);

        if (result.affectedRows === 0 && !Phone_No) {
            // Check if user exists if no rows updated (might be same values)
            // But usually we want to return existing.
        }

        // Update Phones if provided
        if (Phone_No) {
            const phones = Array.isArray(Phone_No) ? Phone_No : [Phone_No];
            const validPhones = phones.filter(p => p && p.trim().length > 0);

            // Delete old
            await db.query("DELETE FROM USER_PHONES WHERE User_ID = ?", [userId]);

            // Insert new
            if (validPhones.length > 0) {
                const phoneValues = validPhones.map((p, index) => [userId, p, index === 0]);
                await db.query("INSERT INTO USER_PHONES (User_ID, Phone_No, Is_Primary) VALUES ?", [phoneValues]);
            }
        }

        // Return updated user data
        const [rows] = await db.execute('SELECT * FROM USERS WHERE User_ID = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const [phoneRows] = await db.query('SELECT Phone_No FROM USER_PHONES WHERE User_ID = ? ORDER BY Is_Primary DESC, Phone_ID ASC', [userId]);
        const userPhones = phoneRows.map(p => p.Phone_No);

        const { Password, ...user } = rows[0];
        user.Phone_No = userPhones;

        res.json(user);

    } catch (err) {
        // If Phone_No is not provided, we might still fail if User not found?
        // Let's rely on standard error handling.
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
