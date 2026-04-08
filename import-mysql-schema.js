#!/usr/bin/env node

/**
 * FinTrack Azure MySQL Schema Import
 * Imports database schema, procedures, triggers, and seed data
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const CONFIG = {
  host: 'mysqlfintrack7844.mysql.database.azure.com',
  user: 'fintrackadmin',
  password: 'FinTrack@Azure2024!',
  database: 'fintrack_final',
  port: 3306,
  ssl: {
    rejectUnauthorized: false  // Required for Azure MySQL Flexible Server
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000
};

const SCHEMA_FILES = [
  'database/mysql/01_create_tables.sql',
  'database/mysql/02_stored_procedures.sql',
  'database/mysql/03_triggers.sql',
  'database/mysql/05_seed_data.sql'
];

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 FinTrack Azure MySQL Schema Import');
console.log('╚════════════════════════════════════════════════════════════╝\n');

async function importSchema() {
  let connection = null;
  
  try {
    console.log('📡 Connecting to MySQL...');
    console.log(`   Host: ${CONFIG.host}`);
    console.log(`   Database: ${CONFIG.database}\n`);

    connection = await mysql.createConnection(CONFIG);
    console.log('✅ Connected successfully!\n');

    let successCount = 0;

    for (const schemaFile of SCHEMA_FILES) {
      if (!fs.existsSync(schemaFile)) {
        console.log(`⚠️  Skipping missing file: ${schemaFile}`);
        continue;
      }

      console.log(`📄 Importing: ${schemaFile}`);
      const fileSize = fs.statSync(schemaFile).size;
      console.log(`   Size: ${(fileSize / 1024).toFixed(1)} KB`);

      try {
        const sqlContent = fs.readFileSync(schemaFile, 'utf-8');
        
        // Split by semicolon and execute each statement
        const statements = sqlContent
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        console.log(`   Statements: ${statements.length}`);
        
        let executed = 0;
        for (const statement of statements) {
          try {
            const result = await connection.execute(statement);
            executed++;
            
            // Show progress every 5 statements
            if (executed % 5 === 0) {
              console.log(`   → Executed ${executed}/${statements.length}`);
            }
          } catch (err) {
            // Some statements might fail, log but continue
            if (!err.message.includes('already exists') && 
                !err.message.includes('Duplicate')) {
              console.log(`   ⚠️  Statement ${executed}: ${err.message.substring(0, 50)}`);
            }
          }
        }

        console.log(`✅ Imported: ${schemaFile} (${executed}/${statements.length} statements)\n`);
        successCount++;
      } catch (err) {
        console.log(`❌ Error importing ${schemaFile}:`);
        console.log(`   ${err.message}\n`);
      }
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log(`✅ Schema import complete: ${successCount}/${SCHEMA_FILES.length} files`);
    console.log('════════════════════════════════════════════════════════════\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
      [CONFIG.database]
    );

    if (tables.length > 0) {
      console.log(`📊 Tables created: ${tables.length}`);
      console.log('   ' + tables.map(t => t.TABLE_NAME).join(', '));
      console.log('');
    }

    console.log('✨ Database setup complete!\n');

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run import
importSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
