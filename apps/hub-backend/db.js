const { Pool } = require('pg');
require('dotenv').config();

let poolInstance = null;

function initDb() {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('📦 Postgres database (Neon) initialized');
  }
  return poolInstance;
}

const pool = {
  getConnection: async () => {
    const pgPool = initDb();
    const client = await pgPool.connect();
    return {
      query: async (sql, params = []) => {
        let pgSql = sql;
        
        let paramIndex = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

        const queryUpper = pgSql.trim().toUpperCase();
        const isInsert = queryUpper.startsWith('INSERT');
        
        if (isInsert && !queryUpper.includes('RETURNING ID')) {
          pgSql += ' RETURNING id';
        }

        const result = await client.query(pgSql, params);
        
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

module.exports = { pool, initDb };
