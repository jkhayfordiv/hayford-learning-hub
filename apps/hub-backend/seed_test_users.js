const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function seed() {
  const teacherHash = await bcrypt.hash('password123', 10);
  const studentHash = await bcrypt.hash('password123', 10);

  db.serialize(() => {
    // 1. Create Teacher
    db.run(
      `INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      ['Test', 'Teacher', 'teacher@test.com', teacherHash, 'teacher'],
      function(err) {
        if (err) return console.error(err);
        const teacherId = this.lastID;
        console.log('Teacher created with ID', teacherId);

        // 2. Create Class
        db.run(
          `INSERT INTO classes (class_name, teacher_id) VALUES (?, ?)`,
          ['Test Class 101', teacherId],
          function(err) {
            if (err) return console.error(err);
            const classId = this.lastID;
            console.log('Class created with ID', classId);

            // 3. Create Student in that class
            db.run(
              `INSERT INTO users (first_name, last_name, email, password_hash, role, class_id) VALUES (?, ?, ?, ?, ?, ?)`,
              ['Test', 'Student', 'student@test.com', studentHash, 'student', classId],
              function(err) {
                if (err) return console.error(err);
                console.log('Student created with ID', this.lastID);

                // 4. Also insert a learning module if not exists
                db.run(`INSERT OR IGNORE INTO learning_modules (id, module_name, module_type, description) VALUES (1, 'Writing Practice 1', 'writing', 'General writing module')`);

                console.log('Seed completed successfully.');
              }
            );
          }
        );
      }
    );
  });
}

seed();
