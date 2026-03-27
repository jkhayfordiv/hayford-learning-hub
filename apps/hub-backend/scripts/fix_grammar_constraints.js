const { pool } = require('../db');

/**
 * MIGRATION: Fix Grammar World constraints
 * 
 * This script drops the restrictive CHECK constraints on user_weaknesses 
 * and grammar_progress tables that prevent specific error tags from being saved.
 */
async function fixGrammarConstraints() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Starting constraint fix migration...\n');

    // 1. Drop chk_valid_category from user_weaknesses
    console.log('Checking for chk_valid_category on user_weaknesses...');
    await connection.query(`
      ALTER TABLE user_weaknesses 
      DROP CONSTRAINT IF EXISTS chk_valid_category;
    `);
    console.log('✅ Dropped chk_valid_category constraint');

    // 2. Drop error_category check from grammar_progress
    // Note: Since this is often an auto-generated name, we check the system tables
    console.log('Checking for anonymous CHECK constraints on grammar_progress...');
    
    // In Postgres, we can find the constraint name for a specific table and column
    const [constraints] = await connection.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'grammar_progress'::regclass
      AND contype = 'c';
    `);

    for (const con of constraints) {
      console.log(`Dropping constraint: ${con.conname}`);
      await connection.query(`ALTER TABLE grammar_progress DROP CONSTRAINT IF EXISTS "${con.conname}"`);
    }

    console.log('✅ All restrictive constraints removed');
    console.log('\n🎉 Migration completed successfully! You can now submit grammar mastery checks.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

fixGrammarConstraints()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
