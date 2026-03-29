require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runInstitutionBrandingMigration() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('📝 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/006_update_institution_branding.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executing institution branding migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ Institution branding updated successfully!');
    
    // Verify the updates
    const [institutions] = await connection.query(`
      SELECT id, name, primary_color, secondary_color, logo_url, welcome_text 
      FROM institutions 
      WHERE id IN (1, 4, 5)
      ORDER BY id
    `);
    
    if (institutions.length > 0) {
      console.log('\n📊 Updated Institution Branding:');
      institutions.forEach(inst => {
        console.log(`\n  ${inst.name} (ID ${inst.id}):`);
        console.log(`    - Primary Color: ${inst.primary_color}`);
        console.log(`    - Secondary Color: ${inst.secondary_color}`);
        console.log(`    - Logo: ${inst.logo_url}`);
        console.log(`    - Welcome Text: ${inst.welcome_text}`);
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

runInstitutionBrandingMigration();
