/**
 * Production Database Seeding Script
 * 
 * This script seeds the production database on Render with grammar nodes.
 * It uses the DATABASE_URL environment variable from Render.
 * 
 * Usage:
 * 1. Set DATABASE_URL environment variable to production database
 * 2. Run: node scripts/seed_production.js
 */

const { pool } = require('../db');
const fs = require('fs').promises;
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../content/grammar_nodes');

async function seedGrammarNodes() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🌱 Starting Production Grammar Nodes Seeding...\n');
    console.log(`📂 Reading from: ${CONTENT_DIR}\n`);
    console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Production (Render)' : 'Local'}\n`);

    // Read all JSON files from content directory
    const files = await fs.readdir(CONTENT_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'TEMPLATE.json');

    if (jsonFiles.length === 0) {
      console.log('⚠️  No JSON files found in content directory.');
      console.log('💡 Place your node JSON files in:', CONTENT_DIR);
      return;
    }

    console.log(`📋 Found ${jsonFiles.length} JSON files to process\n`);

    let successCount = 0;
    let failCount = 0;

    // Process each JSON file
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(CONTENT_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const nodeData = JSON.parse(fileContent);

        // Validate required fields
        if (!nodeData.node_id || !nodeData.region || !nodeData.tier || !nodeData.title) {
          console.log(`❌ ${file}: Missing required fields (node_id, region, tier, or title)`);
          failCount++;
          continue;
        }

        // Prepare content_json (everything except the top-level fields we store separately)
        const content_json = {
          prerequisites: nodeData.prerequisites || [],
          lesson_content_markdown: nodeData.lesson_content_markdown || '',
          mastery_check: nodeData.mastery_check || {},
          rewards: nodeData.rewards || { mastery_points: 100, medal_tier: nodeData.tier }
        };

        // Upsert node into database
        await connection.query(`
          INSERT INTO grammar_nodes (
            node_id, 
            region, 
            tier, 
            title, 
            description, 
            content_json, 
            display_order,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          ON CONFLICT (node_id) 
          DO UPDATE SET
            region = EXCLUDED.region,
            tier = EXCLUDED.tier,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            content_json = EXCLUDED.content_json,
            display_order = EXCLUDED.display_order,
            updated_at = CURRENT_TIMESTAMP
        `, [
          nodeData.node_id,
          nodeData.region,
          nodeData.tier,
          nodeData.title,
          nodeData.description || null,
          JSON.stringify(content_json),
          nodeData.display_order || 0
        ]);

        console.log(`✅ ${file}: ${nodeData.node_id} (${nodeData.tier} - ${nodeData.region})`);
        successCount++;

      } catch (error) {
        console.log(`❌ ${file}: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🎉 Seeding Complete!`);
    console.log(`✅ Success: ${successCount} nodes`);
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount} nodes`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 Seeding failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the seeding
seedGrammarNodes()
  .then(() => {
    console.log('\n✨ Production seed script complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Production seed script failed:', err);
    process.exit(1);
  });
