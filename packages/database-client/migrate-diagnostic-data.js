const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../apps/hub-backend/.env') });

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
    console.log('Running migration: ensuring diagnostic_data column on student_scores...');
    await client.query("ALTER TABLE student_scores ADD COLUMN IF NOT EXISTS diagnostic_data JSONB DEFAULT '[]'::jsonb");
    console.log('Migration successful: diagnostic_data column ensured.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
