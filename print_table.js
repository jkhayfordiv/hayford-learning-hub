require('dotenv').config({ path: 'apps/hub-backend/.env' });
const { pool } = require('./apps/hub-backend/db');

async function main() {
  try {
    const connection = await pool.getConnection();
    const [institutions] = await connection.query(`
      SELECT 
        i.id,
        i.name,
        (SELECT COUNT(*) FROM users u WHERE u.institution_id = i.id) as direct_count,
        (SELECT COUNT(DISTINCT ce.user_id) 
           FROM class_enrollments ce 
           JOIN classes c ON ce.class_id = c.id 
           WHERE c.institution_id = i.id) as class_count
      FROM institutions i
      ORDER BY i.id ASC
    `);
    
    console.table(institutions.map(inst => ({
      ...inst,
      total: parseInt(inst.direct_count) + parseInt(inst.class_count)
    })));
    connection.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
