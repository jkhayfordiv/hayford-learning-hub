const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run fix_db.js');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('ALTER TABLE assigned_tasks ADD COLUMN IF NOT EXISTS grammar_topic_id VARCHAR(255);');

    await client.query('ALTER TABLE assigned_tasks DROP CONSTRAINT IF EXISTS assigned_tasks_assignment_type_check;');
    await client.query("ALTER TABLE assigned_tasks ADD CONSTRAINT assigned_tasks_assignment_type_check CHECK (assignment_type IN ('writing', 'vocabulary', 'grammar-practice')); ");

    await client.query('COMMIT');
    console.log('✅ DB fix applied: grammar_topic_id ensured and assignment_type constraint updated.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('❌ Failed to apply DB fix:', error);
  process.exit(1);
});
