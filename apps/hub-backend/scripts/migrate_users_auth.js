const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
});

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run this migration.');
  }

  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_role_check
    `);

    await client.query(`
      ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('student', 'teacher', 'admin'))
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_email_role_key'
        ) THEN
          ALTER TABLE users
          ADD CONSTRAINT users_email_role_key UNIQUE (email, role);
        END IF;
      END
      $$;
    `);

    await client.query('COMMIT');
    console.log('PostgreSQL users/auth constraints migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
