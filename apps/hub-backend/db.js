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

    // Prefer Neon pooler endpoint to avoid cold-start DNS issues
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl.includes('-pooler.')) {
      console.warn('⚠️  DATABASE_URL does not use Neon pooler endpoint. Consider using the -pooler URL for better reliability.');
    }

    poolInstance = new Pool({
      connectionString: dbUrl,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,                      // max simultaneous clients
      idleTimeoutMillis: 30000,     // close idle clients after 30s
      connectionTimeoutMillis: 15000, // fail fast if Neon is cold-starting
      keepAlive: true,              // prevent idle TCP drops on Render
      keepAliveInitialDelayMillis: 10000,
      // Force IPv4 to avoid ENETUNREACH on Render
      family: 4
    });
    console.log('📦 Postgres database (Neon) initialized (IPv4-first)');
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
        const hasReturning = queryUpper.includes('RETURNING');

        const result = await client.query(sql, params);

        if (queryUpper.startsWith('SELECT') || queryUpper.startsWith('PRAGMA') || hasReturning) {
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
