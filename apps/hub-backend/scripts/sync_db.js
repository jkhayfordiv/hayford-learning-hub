require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function syncDb() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === '[PASTE_YOUR_NEON_POSTGRESQL_LINK_HERE]') {
    console.error('❌ Error: Please paste your actual Neon PostgreSQL link into the .env file.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Neon PostgreSQL...');
    await client.connect();
    
    const schemaPath = path.resolve(__dirname, '../../../packages/database-client/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema.sql...');
    await client.query(schema);
    
    console.log('✅ Neon Postgres database schema synchronized successfully!');
  } catch (err) {
    console.error('❌ Failed to sync database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

syncDb();
