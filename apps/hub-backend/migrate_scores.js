const { pool } = require('./db');

async function migrate() {
  console.log('Starting migration for student_scores...');
  try {
    const connection = await pool.getConnection();

    // 1. Add columns to student_scores if they don't exist
    // teacher_comment might already exist if solo practice are commentable, but let's check
    await connection.query(`
      ALTER TABLE student_scores 
      ADD COLUMN IF NOT EXISTS teacher_comment TEXT,
      ADD COLUMN IF NOT EXISTS teacher_comment_read BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS grader_id INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS feedback_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS assignment_id INTEGER REFERENCES assigned_tasks(id)
    `);
    console.log('Added columns to student_scores.');

    connection.release();
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
