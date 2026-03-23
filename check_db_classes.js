const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/jkhay/.gemini/antigravity/scratch/hayford-learning-hub/apps/hub-backend/.env' });

async function checkClasses() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { rows: classes } = await pool.query('SELECT * FROM classes');
    const { rows: users } = await pool.query("SELECT id, email, role, institution_id FROM users WHERE role IN ('admin', 'super_admin', 'teacher')");
    
    console.log('Classes Count:', classes.length);
    console.log('Classes:', JSON.stringify(classes, null, 2));
    console.log('Privileged Users:', JSON.stringify(users, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkClasses();
