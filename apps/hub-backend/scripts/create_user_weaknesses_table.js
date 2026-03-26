const { pool } = require('../db');

async function createUserWeaknessesTable() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Creating user_weaknesses table...\n');

    // Drop table if exists to ensure clean migration
    await connection.query(`DROP TABLE IF EXISTS user_weaknesses CASCADE;`);
    console.log('🧹 Dropped existing user_weaknesses table if present');

    await connection.query(`
      CREATE TABLE user_weaknesses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        error_tag VARCHAR(100) NOT NULL,
        error_count INTEGER DEFAULT 1,
        last_failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, error_tag)
      );
    `);
    console.log('✅ Created user_weaknesses table');

    await connection.query(`
      CREATE INDEX idx_user_weaknesses_tag ON user_weaknesses(error_tag);
    `);
    console.log('✅ Created index on error_tag');

    console.log('\n🎉 user_weaknesses table created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  } finally {
    connection.release();
  }
}

createUserWeaknessesTable()
  .then(() => {
    console.log('\n✨ Migration complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Migration failed:', err);
    process.exit(1);
  });
