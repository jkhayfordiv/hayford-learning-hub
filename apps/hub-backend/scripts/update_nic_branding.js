require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function updateNicBranding() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('🎨 Updating NIC International College branding...');
    
    await connection.query(`
      UPDATE institutions SET
        subdomain = $1,
        primary_color = $2,
        secondary_color = $3,
        logo_url = $4,
        favicon_url = $5,
        welcome_text = $6
      WHERE id = 4
    `, ['nic', '#110b65', '#ffffff', '/logos/nic-logo.png', '/favicon.ico', 'Welcome to the NIC Student Portal']);
    
    console.log('✅ NIC branding updated successfully!');
    
    // Verify the update
    const [institutions] = await connection.query(
      "SELECT id, name, subdomain, primary_color, secondary_color, logo_url, welcome_text FROM institutions WHERE id = 4"
    );
    
    if (institutions.length > 0) {
      console.log('\n📊 Updated NIC Institution:');
      console.log(JSON.stringify(institutions[0], null, 2));
    } else {
      console.log('⚠️  Warning: Institution ID 4 not found');
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

updateNicBranding();
