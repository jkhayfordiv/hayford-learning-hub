require('dotenv').config();
const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

async function runGrammarLevelMigration() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/007_add_grammar_level_range.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔧 Running migration: Add level_range column to assigned_tasks...');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
    
    for (const statement of statements) {
      if (statement.toLowerCase().includes('alter table')) {
        await connection.query(statement);
        console.log('✅ Added level_range column');
      } else if (statement.toLowerCase().includes('select')) {
        const [rows] = await connection.query(statement);
        console.log('\n📊 Column verification:');
        console.table(rows);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

runGrammarLevelMigration();
