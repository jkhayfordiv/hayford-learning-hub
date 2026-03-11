const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : null;

if (!dbUrl) {
  console.error("No DATABASE_URL found in root .env");
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('Connecting to Neon Database natively...');
  try {
    await client.connect();
    
    console.log('Altering "classes" table...');
    
    try { await client.query(`ALTER TABLE classes ADD COLUMN start_date DATE;`); console.log('--> Added start_date'); } catch(e){}
    try { await client.query(`ALTER TABLE classes ADD COLUMN end_date DATE;`); console.log('--> Added end_date'); } catch(e){}
    
    await client.query(`UPDATE classes SET start_date = CURRENT_DATE, end_date = CURRENT_DATE + INTERVAL '1 year' WHERE start_date IS NULL;`);
    console.log('--> Initialized Default Dates');

    await client.end();
    console.log('Done.');
  } catch (err) {
    console.error(err);
  }
}

migrate();
