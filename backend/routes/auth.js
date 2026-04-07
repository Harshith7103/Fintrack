const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// Simple password hashing function
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Register New User
router.post('/demo-admin', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM USERS WHERE role = 'ADMIN' LIMIT 1");
        if (rows.length === 0) return res.status(404).json({ error: 'No admin found' });
        
        const user = rows[0];
        const [phoneRows] = await db.query('SELECT Phone_No FROM USER_PHONES WHERE User_ID = ? ORDER BY Is_Primary DESC, Phone_ID ASC', [user.User_ID]);
        const phones = phoneRows.map(row => row.Phone_No);

        const { Password, ...userData } = user;
        userData.Phone_No = phones;

        res.json({ user: userData, message: 'Demo Admin Login successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/register', async (req, res) => {
    const { name, email, phone, address, occupation, monthly_income, password } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }

    // Normalize phone to array
    // If phone is a string (e.g. from old form), wrap it. If it's already an array, use it.
    const phones = Array.isArray(phone) ? phone : [phone];

    // Filter out empty strings if any
    const validPhones = phones.filter(p => p && p.trim().length > 0);

    if (validPhones.length === 0) {
        return res.status(400).json({ error: 'At least one valid phone number is required' });
    }

    // Hash the password
    const hashedPassword = hashPassword(password);

    try {
        // 1. Insert User (Phone_No column is removed/ignored)
        const userSql = `INSERT INTO USERS (Name, Email, Address, Occupation, Monthly_Income, Password) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
        const [userResult] = await db.execute(userSql, [
            name,
            email,
            address || '',
            occupation || 'Student',
            monthly_income || 0,
            hashedPassword
        ]);

        const userId = userResult.insertId;
        const initialBalance = monthly_income || 0;

        // 2. Insert Phones into USER_PHONES
        if (validPhones.length > 0) {
            const phoneSql = `INSERT INTO USER_PHONES (User_ID, Phone_No, Is_Primary) VALUES ?`;
            const phoneValues = validPhones.map((p, index) => [userId, p, index === 0]);
            await db.query(phoneSql, [phoneValues]);
        }

        // 3. Create Default Cash Account with 0 balance (Transaction will update it via Trigger)
        const accountSql = 'INSERT INTO ACCOUNT (User_ID, Account_Name, Account_Type, Balance) VALUES (?, ?, ?, ?)';
        const [accountResult] = await db.execute(accountSql, [userId, 'Cash Wallet', 'Cash', 0]);

        const accountId = accountResult.insertId;

        // 4. Log Opening Balance Transaction if income > 0
        if (initialBalance > 0) {
            const today = new Date().toISOString().split('T')[0];
            const transSql = `INSERT INTO \`TRANSACTION\` 
                (User_ID, Account_ID, Category_ID, Amount, Transaction_Type, Reference_Type, Description, Transaction_DateTime) 
                VALUES (?, ?, NULL, ?, 'Income', 'Salary', 'Opening Balance', ?)`;

            await db.execute(transSql, [userId, accountId, initialBalance, today]);
        }

        // 5. Create Default Categories
        const defaultCategories = [
            { name: 'Salary', type: 'Income' },
            { name: 'Food', type: 'Expense' },
            { name: 'Travel', type: 'Expense' },
            { name: 'Bills', type: 'Expense' },
            { name: 'Shopping', type: 'Expense' },
            { name: 'Rent', type: 'Expense' },
            { name: 'Health', type: 'Expense' },
            { name: 'Entertainment', type: 'Expense' }
        ];

        // Use Promise.all to insert all categories in parallel
        const categoryPromises = defaultCategories.map(cat => {
            return db.execute("INSERT INTO CATEGORY (User_ID, Category_Name, Category_Type) VALUES (?, ?, ?)",
                [userId, cat.name, cat.type]);
        });
        await Promise.all(categoryPromises);

        // Return user data without password
        res.json({
            id: userId,
            name,
            email,
            phone: validPhones,
            message: 'Registration successful'
        });

    } catch (err) {
        console.error("Registration Error:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email or phone already registered' });
        }
        return res.status(500).json({ error: err.message });
    }
});

// Login User
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = hashPassword(password);

    try {
        const [rows] = await db.execute('SELECT * FROM USERS WHERE Email = ? AND Password = ?', [email, hashedPassword]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.role === 'ADMIN') {
            return res.status(403).json({ 
                error: 'ADMIN_NOT_ALLOWED', 
                message: 'Admin accounts must use the specialized Admin Login portal.' 
            });
        }

        const accountStatus = user.Account_Status || 'active';
        if (accountStatus === 'blocked') {
            return res.status(403).json({
                error: 'ACCOUNT_BLOCKED',
                message:
                    'Your account has been suspended due to suspicious payment and transaction activity. Please contact support if you believe this is a mistake.'
            });
        }

        // Fetch phones
        const [phoneRows] = await db.query('SELECT Phone_No FROM USER_PHONES WHERE User_ID = ? ORDER BY Is_Primary DESC, Phone_ID ASC', [user.User_ID]);
        const phones = phoneRows.map(row => row.Phone_No);

        // Return user data without password
        const { Password, ...userData } = user;
        userData.Phone_No = phones; // Attach phones array

        // Log Login Event
        try {
            // Calculate Snapshot Stats for Login Log
            const [stats] = await db.query(
                `SELECT 
                        COALESCE(SUM(CASE WHEN Transaction_Type = 'Income' THEN Amount ELSE 0 END), 0) as Total_Income,
                        COALESCE(SUM(CASE WHEN Transaction_Type = 'Expense' THEN Amount ELSE 0 END), 0) as Total_Expense
                     FROM \`TRANSACTION\` WHERE User_ID = ?`,
                [user.User_ID]
            );

            const loginDesc = `User Login. Lifetime Income: ${stats[0].Total_Income || 0}, Lifetime Expense: ${stats[0].Total_Expense || 0}`;

            await db.execute(
                `INSERT INTO AUDIT_LOG (Changed_By_User_ID, Action_Type, Table_Name, Description, Timestamp)
                     VALUES (?, 'LOGIN', 'SYSTEM', ?, NOW())`,
                [user.User_ID, loginDesc]
            );
        } catch (auditErr) {
            console.error("Failed to log login:", auditErr);
        }

        res.json({
            user: userData,
            message: 'Login successful'
        });

    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// Get User Profile
router.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const [rows] = await db.execute(
            'SELECT User_ID, Name, Email, Address, Occupation, Monthly_Income, Created_At FROM USERS WHERE User_ID = ?',
            [userId]
        );
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch Phones
        const [phoneRows] = await db.query('SELECT Phone_No FROM USER_PHONES WHERE User_ID = ? ORDER BY Is_Primary DESC, Phone_ID ASC', [userId]);
        user.Phone_No = phoneRows.map(row => row.Phone_No); // array of numbers

        res.json(user);

    } catch (err) {
        console.error("Profile Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
