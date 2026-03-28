const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Starting multi-tenant SaaS migration...\n');

    const migrationPath = path.join(__dirname, '../migrations/001_multi_tenant_saas.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...');
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Verifying changes...');

    // Verify institutions table
    const institutionsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'institutions' 
      AND column_name IN ('subdomain', 'timezone', 'has_grammar_world', 'has_ielts_speaking', 'stripe_customer_id', 'subscription_tier', 'subscription_status')
      ORDER BY column_name
    `);
    console.log('\n✓ Institutions table columns:', institutionsResult.rows.map(r => r.column_name).join(', '));

    // Verify terms table exists
    const termsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'terms'
      )
    `);
    console.log('✓ Terms table exists:', termsResult.rows[0].exists);

    // Verify users table
    const usersResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('student_id', 'is_active', 'deleted_at', 'last_login_at')
      ORDER BY column_name
    `);
    console.log('✓ Users table columns:', usersResult.rows.map(r => r.column_name).join(', '));

    // Verify default institution
    const defaultInst = await pool.query(`
      SELECT id, name, subdomain, has_grammar_world, has_ielts_speaking 
      FROM institutions 
      WHERE id = 1
    `);
    console.log('✓ Default institution:', defaultInst.rows[0]);

    console.log('\n🎉 Migration verification complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
