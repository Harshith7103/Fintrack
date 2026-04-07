const db = require('./db');

async function updateStoredProcedures() {
    try {
        console.log("Updating Stored Procedures...");

        // 1. Drop old procedure
        await db.query("DROP PROCEDURE IF EXISTS sp_register_user");

        // 2. Create new procedure
        const sp_register_user = `
            CREATE PROCEDURE sp_register_user(
                IN p_Name VARCHAR(100),
                IN p_Email VARCHAR(100),
                IN p_Phone VARCHAR(20),
                IN p_Address TEXT,
                IN p_Occupation VARCHAR(50),
                IN p_Monthly_Income DECIMAL(15,2),
                IN p_Password VARCHAR(255)
            )
            BEGIN
                INSERT INTO USERS (Name, Email, Address, Occupation, Monthly_Income, Password, Last_Login)
                VALUES (p_Name, p_Email, p_Address, p_Occupation, p_Monthly_Income, p_Password, NOW());
                
                INSERT INTO USER_PHONES (User_ID, Phone_No, Is_Primary)
                VALUES (LAST_INSERT_ID(), p_Phone, TRUE);
            END
        `;

        await db.query(sp_register_user);
        console.log("Updated sp_register_user.");

        console.log("All procedures updated successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Failed to update procedures:", err);
        process.exit(1);
    }
}

updateStoredProcedures();
