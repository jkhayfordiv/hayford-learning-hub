const { pool } = require('../db');

async function createGrammarTables() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Creating Grammar World Map tables...\n');

    // 1. Grammar Nodes Table (Core Content Storage)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grammar_nodes (
        node_id VARCHAR(50) PRIMARY KEY,
        region VARCHAR(100) NOT NULL,
        tier VARCHAR(20) CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Diagnostic')),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content_json JSONB NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created grammar_nodes table');

    // Create indexes for grammar_nodes
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_grammar_nodes_region ON grammar_nodes(region);
    `);
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_grammar_nodes_tier ON grammar_nodes(tier);
    `);
    console.log('✅ Created indexes for grammar_nodes');

    // 2. User Grammar Progress Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_grammar_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        node_id VARCHAR(50) NOT NULL REFERENCES grammar_nodes(node_id) ON DELETE CASCADE,
        status VARCHAR(20) CHECK (status IN ('locked', 'unlocked', 'in_progress', 'completed')) DEFAULT 'locked',
        attempts INTEGER DEFAULT 0,
        last_score INTEGER,
        last_attempt_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, node_id)
      );
    `);
    console.log('✅ Created user_grammar_progress table');

    // Create indexes for user_grammar_progress
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_user ON user_grammar_progress(user_id);
    `);
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_status ON user_grammar_progress(user_id, status);
    `);
    console.log('✅ Created indexes for user_grammar_progress');

    // 3. User Mastery Stats Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_mastery_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        region VARCHAR(100) NOT NULL,
        nodes_completed INTEGER DEFAULT 0,
        total_nodes INTEGER DEFAULT 0,
        mastery_points INTEGER DEFAULT 0,
        bronze_medals INTEGER DEFAULT 0,
        silver_medals INTEGER DEFAULT 0,
        gold_medals INTEGER DEFAULT 0,
        average_score DECIMAL(5,2),
        last_activity_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, region)
      );
    `);
    console.log('✅ Created user_mastery_stats table');

    // Create indexes for user_mastery_stats
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_user_mastery_stats_user ON user_mastery_stats(user_id);
    `);
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_user_mastery_stats_region ON user_mastery_stats(user_id, region);
    `);
    console.log('✅ Created indexes for user_mastery_stats');

    // 4. Grammar Activity Submissions Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grammar_activity_submissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        node_id VARCHAR(50) NOT NULL REFERENCES grammar_nodes(node_id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        user_response JSONB NOT NULL,
        ai_feedback JSONB,
        score INTEGER,
        passed BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created grammar_activity_submissions table');

    // Create index for submissions
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_grammar_submissions_user_node ON grammar_activity_submissions(user_id, node_id);
    `);
    console.log('✅ Created indexes for grammar_activity_submissions');

    console.log('\n🎉 All Grammar World Map tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the migration
createGrammarTables()
  .then(() => {
    console.log('\n✨ Migration complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Migration failed:', err);
    process.exit(1);
  });
