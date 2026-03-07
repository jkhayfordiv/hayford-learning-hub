const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the SQLite database file
const dbPath = path.resolve(__dirname, '../../apps/hub-backend/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

db.serialize(() => {
  console.log('Running migration: Adding diagnostic_data column to student_scores...');
  
  db.run(`ALTER TABLE student_scores ADD COLUMN diagnostic_data TEXT;`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column diagnostic_data already exists. Migration skipped.');
      } else {
        console.error('Migration failed:', err.message);
      }
    } else {
      console.log('Migration successful: diagnostic_data column added.');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});
