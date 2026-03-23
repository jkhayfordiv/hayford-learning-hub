const { Pool } = require('pg');
require('dotenv').config();

async function checkClasses() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { rows: classes } = await pool.query('SELECT id, class_name, teacher_id, institution_id FROM classes');
    const { rows: enrollments } = await pool.query('SELECT ce.*, u.role, u.email FROM class_enrollments ce JOIN users u ON ce.user_id = u.id');
    
    console.log('--- CLASSES ---');
    classes.forEach(c => console.log(JSON.stringify(c)));
    console.log('--- ENROLLMENTS ---');
    enrollments.forEach(e => console.log(JSON.stringify(e)));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkClasses();
