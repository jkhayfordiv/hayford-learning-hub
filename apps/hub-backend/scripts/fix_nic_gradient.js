require('dotenv').config();
const { pool } = require('../db');

async function fixNICGradient() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('🔧 Updating NIC International College gradient colors...');
    await connection.query(`
      UPDATE institutions 
      SET secondary_color = $1
      WHERE id = 4
    `, ['#0c0847']);
    
    console.log('✅ NIC gradient updated successfully!');
    
    // Verify the update
    const [institutions] = await connection.query(`
      SELECT id, name, primary_color, secondary_color 
      FROM institutions 
      WHERE id = 4
    `);
    
    if (institutions.length > 0) {
      console.log('\n📊 Updated NIC Branding:');
      const inst = institutions[0];
      console.log(`  ${inst.name} (ID ${inst.id}):`);
      console.log(`    - Primary Color: ${inst.primary_color}`);
      console.log(`    - Secondary Color: ${inst.secondary_color}`);
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

fixNICGradient();
