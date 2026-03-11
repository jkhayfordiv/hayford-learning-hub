const { pool } = require('../db');

async function migrate() {
  try {
    const connection = await pool.getConnection();
    console.log('Adding status column to assigned_tasks if missing...');
    await connection.query(`
      ALTER TABLE assigned_tasks 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    `);
    try {
      await connection.query(`UPDATE assigned_tasks SET status = 'pending' WHERE status IS NULL`);
    } catch (e) {
      // Column might not exist yet on some DBs
    }
    console.log('Migration successful: assigned_tasks.status ready.');
    connection.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
