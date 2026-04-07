# MySQL Database Layer

This directory contains the SQL scripts required to set up the relational database for FinTrack.

## Prerequisites
- MySQL Server (8.0+)
- MySQL Workbench or Command Line Client

## Installation Order
Run the scripts in the following order to ensure dependencies are met:

1. **`01_create_tables.sql`**: Creates the database schema (Tables & Constraints).
2. **`02_stored_procedures.sql`**: Sets up business logic functions.
3. **`03_triggers.sql`**: Enables automation for balances and audits.
4. **`04_views.sql`**: Creates reporting views.
5. **`05_seed_data.sql`**: Populates the database with sample data for testing.

## How to Run
Open your terminal or command prompt:

```bash
mysql -u root -p < 01_create_tables.sql
mysql -u root -p < 02_stored_procedures.sql
mysql -u root -p < 03_triggers.sql
mysql -u root -p < 04_views.sql
mysql -u root -p < 05_seed_data.sql
```

## Features
- **Triggers**: Automatically update account balances when transactions are logged.
- **Stored Procedures**: `sp_add_transaction` ensures data integrity during insertion.
- **Views**: `vw_user_transaction_history` simplifies frontend queries.
