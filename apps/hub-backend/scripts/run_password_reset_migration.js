require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runPasswordResetMigration() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('📝 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/003_password_reset_tokens.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executing password reset migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ Password reset columns added successfully!');
    
    // Verify the columns
    const [columns] = await connection.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('reset_password_token', 'reset_password_expires')
    `);
    
    if (columns.length > 0) {
      console.log('\n📊 Added Columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

runPasswordResetMigration();
