/**
 * sync_grammar_nodes.js
 *
 * Reads every JSON file in content/grammar_nodes/ and UPSERTs it into the
 * grammar_nodes table.  Run once after any curriculum update:
 *
 *   node apps/hub-backend/scripts/sync_grammar_nodes.js
 */

// Load .env from the hub-backend directory explicitly
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const { pool } = require('../db');

const NODES_DIR = path.join(__dirname, '../content/grammar_nodes');

async function syncNodes() {
  const connection = await pool.getConnection();

  try {
    const files = fs.readdirSync(NODES_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} node JSON files to sync.\n`);

    let success = 0;
    let errors  = 0;

    for (const file of files) {
      const filePath = path.join(NODES_DIR, file);

      let content;
      try {
        content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (parseErr) {
        console.error(`  ❌  PARSE ERROR  ${file}: ${parseErr.message}`);
        errors++;
        continue;
      }

      const {
        node_id,
        title,
        description,
        display_order = 0,
        rewards       = {},
      } = content;

      // region and tier can live at the top level of the JSON (newer format)
      // or may be absent (older placeholders – skip those gracefully)
      const region = content.region || null;
      const tier   = rewards.medal_tier || content.tier || null;

      if (!node_id || !region || !tier) {
        console.warn(`  ⚠   SKIP  ${file}  (missing node_id, region, or tier)`);
        continue;
      }

      try {
        await connection.query(
          `INSERT INTO grammar_nodes
             (node_id, region, tier, title, description, content_json, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (node_id) DO UPDATE SET
             region        = EXCLUDED.region,
             tier          = EXCLUDED.tier,
             title         = EXCLUDED.title,
             description   = EXCLUDED.description,
             content_json  = EXCLUDED.content_json,
             display_order = EXCLUDED.display_order,
             updated_at    = CURRENT_TIMESTAMP`,
          [node_id, region, tier, title, description, JSON.stringify(content), display_order],
        );
        console.log(`  ✅  ${node_id}  (${region} / ${tier})`);
        success++;
      } catch (dbErr) {
        console.error(`  ❌  DB ERROR  ${file}: ${dbErr.message}`);
        errors++;
      }
    }

    console.log(`\n--- Sync complete: ${success} synced, ${errors} errors ---`);
  } finally {
    connection.release();
    process.exit(0);
  }
}

syncNodes().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
