require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function addNicInstitution() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('📝 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/002_add_nic_institution.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executing NIC institution migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ NIC College institution created successfully!');
    
    // Verify the institution
    const [institutions] = await connection.query(
      "SELECT id, name, subdomain, primary_color, secondary_color, logo_url, welcome_text FROM institutions WHERE subdomain = 'nic'"
    );
    
    if (institutions.length > 0) {
      console.log('\n📊 NIC Institution Details:');
      console.log(JSON.stringify(institutions[0], null, 2));
    } else {
      console.log('⚠️  Warning: NIC institution not found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

addNicInstitution();
