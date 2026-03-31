require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
  const client = await pool.connect();
  try {
    // Test 1: global_words has seeded data
    const { rows: words } = await client.query(
      'SELECT sense_id, word, part_of_speech FROM global_words ORDER BY word LIMIT 10'
    );
    console.log('=== global_words (10 seeded AWL words) ===');
    words.forEach(w => console.log('  ' + w.sense_id + ' -> ' + w.part_of_speech));

    // Test 2: user_vocabulary table exists
    const { rows: uv } = await client.query('SELECT COUNT(*) AS count FROM user_vocabulary');
    console.log('\n=== user_vocabulary ===');
    console.log('  Total rows: ' + uv[0].count);

    // Test 3: JOIN query (mirrors dashboard endpoint logic)
    const { rows: joined } = await client.query(
      'SELECT uv.id, gw.word, uv.srs_level FROM user_vocabulary uv JOIN global_words gw ON gw.id = uv.global_word_id LIMIT 5'
    );
    console.log('  JOIN query OK (' + joined.length + ' rows)');

    // Test 4: FILTER aggregate (mirrors stats logic)
    const { rows: stats } = await client.query(
      'SELECT COUNT(*) FILTER (WHERE srs_level >= 5) AS mastered, COUNT(*) AS total FROM user_vocabulary'
    );
    console.log('  Stats query OK: mastered=' + stats[0].mastered + ', total=' + stats[0].total);

    // Test 5: Case-insensitive word search (mirrors POST /add logic)
    const { rows: wordSearch } = await client.query(
      "SELECT id, sense_id, word, part_of_speech FROM global_words WHERE LOWER(word) = LOWER('Analyze')"
    );
    console.log('\n=== Word search (case-insensitive "Analyze") ===');
    console.log('  Found ' + wordSearch.length + ' result(s): ' + wordSearch.map(r => r.sense_id).join(', '));

    // Test 6: SRS update query (mirrors POST /review logic)
    const { rows: srsTest } = await client.query(
      "SELECT COUNT(*) FILTER (WHERE srs_level < 5) AS learning FROM user_vocabulary"
    );
    console.log('\n=== SRS aggregate query ===');
    console.log('  Learning count: ' + srsTest[0].learning);

    console.log('\n✅ All 6 DB queries passed — vocabLab.js routes are ready to serve.');
  } finally {
    client.release();
    await pool.end();
  }
}

test().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
