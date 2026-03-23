require('dotenv').config({ path: 'apps/hub-backend/.env' });
const { pool } = require('./apps/hub-backend/db');
const fs = require('fs');

async function main() {
  try {
    const connection = await pool.getConnection();
    
    const [institutions] = await connection.query(`
      SELECT 
        i.id,
        i.name,
        i.address,
        i.contact_email,
        i.created_at,
        COUNT(DISTINCT linked_users.id) AS total_users,
        COUNT(DISTINCT CASE WHEN linked_users.role = 'student' THEN linked_users.id END) AS student_count
      FROM institutions i
      LEFT JOIN (
        SELECT id, role, institution_id FROM users WHERE institution_id IS NOT NULL
        UNION
        SELECT u.id, u.role, c.institution_id
        FROM class_enrollments ce
        JOIN users u ON u.id = ce.user_id
        JOIN classes c ON c.id = ce.class_id
      ) AS linked_users ON linked_users.institution_id = i.id
      GROUP BY i.id
      ORDER BY i.id ASC
    `);

    // Ensure counts are numbers
    const institutionsWithCount = institutions.map(inst => ({
      ...inst,
      total_users: parseInt(inst.total_users) || 0,
      student_count: parseInt(inst.student_count) || 0,
      raw_total_users: inst.total_users,
      raw_student_count: inst.student_count
    }));

    fs.writeFileSync('db_dump.json', JSON.stringify(institutionsWithCount, null, 2));

    connection.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
