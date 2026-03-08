const { pool } = require('../db');

async function migrateClassCodes() {
  try {
    const connection = await pool.getConnection();
    console.log('Adding class_code column to classes table...');
    
    // Add the column
    await connection.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_code VARCHAR(10) UNIQUE');
    
    console.log('Migration successful: class_code added.');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateClassCodes();
