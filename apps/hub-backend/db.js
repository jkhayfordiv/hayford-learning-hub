const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let poolInstance = null;

function initDb() {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
    }

    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });
    console.log('📦 Postgres database (Neon) initialized');
  }
  return poolInstance;
}

async function bootstrapDatabase() {
  const pgPool = initDb();
  const schemaPath = path.resolve(__dirname, '../../packages/database-client/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pgPool.query(schemaSql);
  console.log('✅ Database schema ensured from packages/database-client/schema.sql');
}

const pool = {
  getConnection: async () => {
    const pgPool = initDb();
    const client = await pgPool.connect();
    return {
      query: async (sql, params = []) => {
        const queryUpper = sql.trim().toUpperCase();
        const isInsert = queryUpper.startsWith('INSERT');

        const result = await client.query(sql, params);
        
        if (queryUpper.startsWith('SELECT') || queryUpper.startsWith('PRAGMA')) {
           return [result.rows];
        } else {
           const insertId = isInsert && result.rows.length > 0 ? result.rows[0].id : null;
           return [{ insertId, affectedRows: result.rowCount }];
        }
      },
      release: () => {
        client.release();
      }
    };
  }
};

module.exports = { pool, initDb, bootstrapDatabase };
