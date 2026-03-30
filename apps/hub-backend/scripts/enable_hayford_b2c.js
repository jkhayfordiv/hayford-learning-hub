require('dotenv').config();
const { pool } = require('../db');

async function run() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Show all institutions and their current b2c / tier settings
    const [all] = await connection.query(
      `SELECT id, name, allow_b2c_payments, subscription_tier FROM institutions ORDER BY id`
    );
    console.log('\n📊 All institutions:');
    all.forEach(i =>
      console.log(`  [${i.id}] ${i.name}  allow_b2c_payments=${i.allow_b2c_payments}  tier=${i.subscription_tier}`)
    );

    // Enable b2c payments for any institution whose name contains "Hayford"
    const [result] = await connection.query(
      `UPDATE institutions SET allow_b2c_payments = TRUE WHERE LOWER(name) LIKE '%hayford%'`
    );
    console.log(`\n✅ Rows updated: ${result.rowCount ?? result.affectedRows ?? 'unknown'}`);

    // Show after state
    const [after] = await connection.query(
      `SELECT id, name, allow_b2c_payments, subscription_tier FROM institutions WHERE LOWER(name) LIKE '%hayford%'`
    );
    console.log('\n📋 Hayford institution(s) after update:');
    after.forEach(i =>
      console.log(`  [${i.id}] ${i.name}  allow_b2c_payments=${i.allow_b2c_payments}  tier=${i.subscription_tier}`)
    );
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

run();
