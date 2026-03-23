require('dotenv').config({ path: 'apps/hub-backend/.env' });
const { pool } = require('./apps/hub-backend/db');

async function main() {
  try {
    const connection = await pool.getConnection();
    
    console.log("--- INSTITUTIONS ---");
    const [institutions] = await connection.query('SELECT id, name FROM institutions');
    console.log(institutions);

    console.log("\n--- USERS ---");
    const [users] = await connection.query('SELECT id, email, role, institution_id FROM users');
    console.log(users);

    console.log("\n--- CLASS ENROLLMENTS ---");
    const [enrollments] = await connection.query('SELECT user_id, class_id FROM class_enrollments');
    console.log(enrollments);

    console.log("\n--- CLASSES ---");
    const [classes] = await connection.query('SELECT id, institution_id, teacher_id FROM classes');
    console.log(classes);

    connection.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
