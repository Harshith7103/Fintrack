-- Admin: block user logins (run once if auto-migration did not run)
USE fintrack_final;

ALTER TABLE USERS
ADD COLUMN Account_Status ENUM('active', 'blocked') NOT NULL DEFAULT 'active';

-- If your database name differs, run against your DB_NAME from .env instead of fintrack_final.
