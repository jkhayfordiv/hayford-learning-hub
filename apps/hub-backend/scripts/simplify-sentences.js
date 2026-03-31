/**
 * simplify-sentences.js
 *
 * Retroactively rewrites all context_sentence values in global_words
 * to A2-B1 CEFR level using Gemini AI.
 *
 * Usage (from apps/hub-backend/):
 *   node scripts/simplify-sentences.js
 *
 * Optional: process only one word for testing:
 *   node scripts/simplify-sentences.js --word analyze
 *
 * Set DRY_RUN=true to preview changes without writing to the DB:
 *   DRY_RUN=true node scripts/simplify-sentences.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const DRY_RUN   = process.env.DRY_RUN === 'true';
const WORD_ARG  = process.argv.find(a => a.startsWith('--word='))?.split('=')[1] ?? null;
const DELAY_MS  = 500; // pause between API calls to avoid rate limits

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SIMPLIFY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    context_sentence: { type: SchemaType.STRING },
  },
  required: ['context_sentence'],
};

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseSchema: SIMPLIFY_SCHEMA,
    responseMimeType: 'application/json',
  },
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simplifySentence(word, pos, currentSentence) {
  const prompt = `You are an EFL vocabulary teacher helping A2-B1 level English learners.

Rewrite the following example sentence for the word "${word}" (${pos}).

Current sentence: "${currentSentence}"

Rules:
- The rewritten sentence MUST use the word "${word}" naturally.
- Maximum 15 words.
- Use only basic grammar (present simple, past simple, common modals).
- Use only high-frequency, everyday vocabulary for the surrounding words.
- Do NOT use complex academic or PhD-level structures.
- Keep the meaning similar to the original.

Return ONLY the new sentence as a JSON object with a single key: context_sentence.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());
  return (parsed.context_sentence || '').trim();
}

async function main() {
  const client = await pool.connect();
  try {
    let query = `SELECT id, sense_id, word, part_of_speech, context_sentence FROM global_words ORDER BY word ASC`;
    const params = [];
    if (WORD_ARG) {
      query = `SELECT id, sense_id, word, part_of_speech, context_sentence FROM global_words WHERE LOWER(word) = $1 ORDER BY sense_id ASC`;
      params.push(WORD_ARG.toLowerCase());
    }

    const { rows } = await client.query(query, params);

    if (rows.length === 0) {
      console.log('No words found in global_words.');
      return;
    }

    console.log(`\nFound ${rows.length} word(s) to process.${DRY_RUN ? ' [DRY RUN — no DB writes]' : ''}\n`);

    let updated = 0;
    let failed  = 0;

    for (const row of rows) {
      const { id, sense_id, word, part_of_speech, context_sentence } = row;
      process.stdout.write(`  ${word} (${sense_id}) ... `);

      try {
        const newSentence = await simplifySentence(word, part_of_speech, context_sentence);

        if (!newSentence) {
          console.log('SKIPPED (empty response)');
          failed++;
          continue;
        }

        if (!DRY_RUN) {
          await client.query(
            `UPDATE global_words SET context_sentence = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [newSentence, id]
          );
        }

        console.log(`OK\n    Before: "${context_sentence}"\n    After:  "${newSentence}"`);
        updated++;
      } catch (err) {
        console.log(`ERROR — ${err.message}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log(`\n─────────────────────────────────────────`);
    console.log(`Done. Updated: ${updated}  |  Failed/skipped: ${failed}`);
    if (DRY_RUN) console.log('DRY RUN — no changes were written to the database.');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
