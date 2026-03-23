require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
  try {
    const connection = await pool.getConnection();

    console.log("Adding grader_id and feedback_date columns...");
    try {
      await connection.query(`ALTER TABLE assigned_tasks ADD COLUMN grader_id INT REFERENCES users(id)`);
      console.log("Added grader_id");
    } catch (e) {
      console.log("grader_id might already exist:", e.message);
    }
    
    try {
      await connection.query(`ALTER TABLE assigned_tasks ADD COLUMN feedback_date TIMESTAMP`);
      console.log("Added feedback_date");
    } catch (e) {
      console.log("feedback_date might already exist:", e.message);
    }

    console.log("Migrating old data...");
    const [result] = await connection.query(`
      UPDATE assigned_tasks 
      SET grader_id = teacher_id, 
          feedback_date = CURRENT_TIMESTAMP 
      WHERE teacher_comment IS NOT NULL AND grader_id IS NULL;
    `);
    console.log(`Migrated ${result.affectedRows || result.rowCount || 0} rows.`);

    connection.release();
    console.log("Migration complete.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
