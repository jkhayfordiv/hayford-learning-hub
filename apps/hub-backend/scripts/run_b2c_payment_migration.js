require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runB2CPaymentMigration() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('📝 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/004_b2c_payment_flag.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executing B2C payment flag migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ B2C payment flag added successfully!');
    
    // Verify the columns
    const [institutions] = await connection.query(`
      SELECT id, name, allow_b2c_payments, subscription_tier 
      FROM institutions 
      WHERE id IN (1, 4)
      ORDER BY id
    `);
    
    if (institutions.length > 0) {
      console.log('\n📊 Institution Payment Settings:');
      institutions.forEach(inst => {
        console.log(`  - ${inst.name} (ID ${inst.id}): allow_b2c_payments=${inst.allow_b2c_payments}, tier=${inst.subscription_tier}`);
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

runB2CPaymentMigration();
