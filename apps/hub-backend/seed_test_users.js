const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
});

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run this seed script.');
  }

  const teacherHash = await bcrypt.hash('password123', 10);
  const studentHash = await bcrypt.hash('password123', 10);

  await client.connect();

  try {
    const teacherInsert = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email, role) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      ['Test', 'Teacher', 'teacher@test.com', teacherHash, 'teacher']
    );
    const teacherId = teacherInsert.rows[0].id;

    const classInsert = await client.query(
      `INSERT INTO classes (class_name, teacher_id)
       VALUES ($1, $2)
       RETURNING id`,
      ['Test Class 101', teacherId]
    );
    const classId = classInsert.rows[0].id;

    const studentInsert = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, class_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email, role) DO UPDATE SET class_id = EXCLUDED.class_id
       RETURNING id`,
      ['Test', 'Student', 'student@test.com', studentHash, 'student', classId]
    );

    await client.query(
      `INSERT INTO learning_modules (id, module_name, module_type, description)
       VALUES (1, 'Writing Practice 1', 'writing', 'General writing module')
       ON CONFLICT (id) DO NOTHING`
    );

    console.log('Teacher ID:', teacherId);
    console.log('Class ID:', classId);
    console.log('Student ID:', studentInsert.rows[0].id);
    console.log('Seed completed successfully.');
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
