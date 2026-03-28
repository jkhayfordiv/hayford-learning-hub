require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runUserSubscriptionMigration() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('📝 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/005_user_subscription_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executing user subscription columns migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ User subscription columns added successfully!');
    
    // Verify the columns
    const [columns] = await connection.query(`
      SELECT column_name, data_type, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('subscription_tier', 'stripe_customer_id')
      ORDER BY column_name
    `);
    
    if (columns.length > 0) {
      console.log('\n📊 Added Columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default}, nullable: ${col.is_nullable})`);
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

runUserSubscriptionMigration();
