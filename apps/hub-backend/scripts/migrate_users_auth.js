const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database at:', dbPath);
});

async function migrate() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create a specific error handler function that rejects the promise
      const handleError = (err, operation) => {
        if (err) {
          console.error(`Error during ${operation}:`, err.message);
          db.run('ROLLBACK', () => reject(err));
          return true; // Indicates error occurred
        }
        return false;
      };

      db.run('BEGIN TRANSACTION');

      console.log('1. Renaming users table to users_old...');
      db.run('ALTER TABLE users RENAME TO users_old', (err) => {
        if (handleError(err, 'Renaming table')) return;

        console.log('2. Creating new users table with UNIQUE(email, role)...');
        const createTableSql = `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            email VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin')),
            target_score DECIMAL(3,1) DEFAULT NULL,
            class_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
            UNIQUE(email, role)
          )
        `;
        db.run(createTableSql, (err) => {
          if (handleError(err, 'Creating new table')) return;

          console.log('3. Copying data from users_old to users...');
          db.run('INSERT INTO users SELECT * FROM users_old', (err) => {
            if (handleError(err, 'Copying data')) return;

            console.log('4. Dropping users_old table...');
            db.run('DROP TABLE users_old', (err) => {
              if (handleError(err, 'Dropping old table')) return;

              db.run('COMMIT', (err) => {
                if (handleError(err, 'Committing transaction')) return;
                console.log('Migration completed successfully!');
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

migrate()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    db.close();
    process.exit(1);
  });
