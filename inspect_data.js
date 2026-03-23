require('dotenv').config({ path: 'apps/hub-backend/.env' });
const { pool } = require('./apps/hub-backend/db');

async function main() {
  try {
    const connection = await pool.getConnection();
    
    console.log("--- Institutions ---");
    const [insts] = await connection.query('SELECT id, name FROM institutions ORDER BY id ASC');
    console.log(insts);
    
    console.log("\n--- Users (First 10) ---");
    const [users] = await connection.query('SELECT id, role, institution_id FROM users LIMIT 10');
    console.log(users);
    
    console.log("\n--- Class Enrollments (First 10) ---");
    const [ce] = await connection.query('SELECT ce.user_id, c.institution_id FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id LIMIT 10');
    console.log(ce);

    connection.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
