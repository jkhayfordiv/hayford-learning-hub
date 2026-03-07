const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let dbInstance = null;

async function initDb() {
  if (dbInstance) return dbInstance;
  
  dbInstance = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  const schemaPath = path.join(__dirname, '../../packages/database-client/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await dbInstance.exec(schema);
  
  console.log('📦 SQLite database initialized and schema verified');
  return dbInstance;
}

const pool = {
  getConnection: async () => {
    const db = await initDb();
    return {
      query: async (sql, params) => {
        const queryUpper = sql.trim().toUpperCase();
        if (queryUpper.startsWith('SELECT') || queryUpper.startsWith('PRAGMA')) {
          const rows = await db.all(sql, params);
          return [rows]; // Wrap in array to simulate mysql2 destructuring
        } else {
          const result = await db.run(sql, params);
          return [{ insertId: result.lastID, affectedRows: result.changes }];
        }
      },
      release: () => {}
    };
  }
};

module.exports = { pool, initDb };
