const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fintrack.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Dropping EMI table...");
    db.run("DROP TABLE IF EXISTS EMI", (err) => {
        if (err) {
            console.error("Error dropping table:", err);
            return;
        }
        console.log("EMI table dropped.");

        console.log("Recreating EMI table...");
        db.run(`CREATE TABLE IF NOT EXISTS EMI (
            EMI_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            User_ID INTEGER NOT NULL,
            Account_ID INTEGER NOT NULL,
            Category_ID INTEGER NOT NULL,
            EMI_Title TEXT NOT NULL,
            Lender_Name TEXT,
            Total_Loan_Amount REAL CHECK(Total_Loan_Amount > 0),
            Interest_Rate REAL CHECK(Interest_Rate >= 0),
            Tenure_Months INTEGER CHECK(Tenure_Months > 0),
            EMI_Amount REAL CHECK(EMI_Amount > 0),
            EMI_Day INTEGER CHECK(EMI_Day BETWEEN 1 AND 31),
            Start_Date DATE NOT NULL,
            End_Date DATE NOT NULL,
            Last_Deducted DATE,
            Status TEXT CHECK(Status IN ('Active', 'Completed', 'Cancelled')) DEFAULT 'Active',
            Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (User_ID) REFERENCES USERS(User_ID) ON DELETE CASCADE,
            FOREIGN KEY (Account_ID) REFERENCES ACCOUNT(Account_ID),
            FOREIGN KEY (Category_ID) REFERENCES CATEGORY(Category_ID)
        )`, (err) => {
            if (err) {
                console.error("Error creating table:", err);
            } else {
                console.log("✅ EMI table successfully recreated with new schema.");
            }
            db.close();
        });
    });
});
