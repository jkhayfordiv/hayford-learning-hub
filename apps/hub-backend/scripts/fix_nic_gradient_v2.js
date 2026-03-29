require('dotenv').config();
const { pool } = require('../db');

async function fixNICGradient() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('🔧 Updating NIC International College gradient colors...');
    
    // Update to dark blue (#110b65) to lighter blue (#1a1575) gradient
    await connection.query(
      `UPDATE institutions SET secondary_color = $1 WHERE id = $2`,
      ['#1a1575', 4]
    );
    
    const [rows] = await connection.query(
      `SELECT id, name, primary_color, secondary_color FROM institutions WHERE id = $1`,
      [4]
    );
    
    console.log('✅ NIC gradient updated successfully!');
    console.log('\n📊 Updated NIC Branding:');
    console.log(`  ${rows[0].name} (ID ${rows[0].id}):`);
    console.log(`    - Primary Color: ${rows[0].primary_color} (dark blue)`);
    console.log(`    - Secondary Color: ${rows[0].secondary_color} (lighter blue)`);
    console.log('\n⚠️  Students must log out and back in to see the new gradient!');
    
  } catch (error) {
    console.error('❌ Failed to update NIC gradient:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

fixNICGradient();
