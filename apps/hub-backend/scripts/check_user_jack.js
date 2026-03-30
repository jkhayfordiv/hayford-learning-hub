require('dotenv').config();
const { pool } = require('../db');

async function run() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.institution_id,
              u.subscription_tier AS user_tier,
              i.name AS institution_name,
              i.subscription_tier AS inst_tier,
              i.allow_b2c_payments
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE LOWER(u.first_name) LIKE '%jack%' OR LOWER(u.last_name) LIKE '%hayford%'
       ORDER BY u.id`
    );
    if (users.length === 0) {
      console.log('No users found matching "jack" or "hayford".');
    } else {
      users.forEach(u => {
        const effectiveTier = u.user_tier || u.inst_tier || 'free';
        console.log(`[${u.id}] ${u.first_name} ${u.last_name} <${u.email}>`);
        console.log(`  role=${u.role}  institution_id=${u.institution_id} (${u.institution_name})`);
        console.log(`  user_tier=${u.user_tier}  inst_tier=${u.inst_tier}  effective_tier=${effectiveTier}`);
        console.log(`  allow_b2c_payments=${u.allow_b2c_payments}`);
        const isFreeB2C = (effectiveTier === 'free') && (u.allow_b2c_payments === true || u.institution_id === 1);
        console.log(`  → isFreeB2C would be: ${isFreeB2C}`);
        console.log('');
      });
    }
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

run();
