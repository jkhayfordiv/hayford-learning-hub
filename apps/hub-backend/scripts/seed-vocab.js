const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pool } = require('pg');
require('dotenv').config();

// ============================================================================
// VOCAB LAB - AI-Powered Global Dictionary Seed Script
// ============================================================================
// This script uses Gemini AI to generate EAP-optimized vocabulary entries
// for the Academic Word List (AWL) and inserts them into global_words table
// ============================================================================

const AWL_BATCH_1 = [
  "analyze",
  "approach", 
  "area",
  "assess",
  "assume",
  "authority",
  "available",
  "benefit",
  "concept",
  "consist"
];

// Initialize Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================================
// GEMINI PROMPT CONFIGURATION
// ============================================================================
const VOCAB_GENERATION_PROMPT = (word) => `
You are an expert EAP (English for Academic Purposes) vocabulary instructor.

Generate a comprehensive vocabulary entry for the word: "${word}"

Requirements:
1. Identify the PRIMARY academic sense of this word (the most common usage in academic writing)
2. Provide a clear, student-friendly definition
3. List 4-6 common academic collocations (phrases this word commonly appears with)
4. Provide the word family (related forms: noun, verb, adjective, adverb, etc.)
5. Create a natural academic context sentence demonstrating proper usage
6. Indicate if it's a separable phrasal verb (true/false)

Return ONLY valid JSON matching this exact structure:
{
  "sense_id": "word_pos_1",
  "word": "the word",
  "part_of_speech": "noun|verb|adjective|adverb",
  "primary_definition": "clear definition for EAP students",
  "collocations": ["collocation 1", "collocation 2", "collocation 3", "collocation 4"],
  "word_family": {
    "noun": "form",
    "verb": "form",
    "adjective": "form",
    "adverb": "form"
  },
  "context_sentence": "A natural academic sentence using the word correctly.",
  "is_separable": false
}

CRITICAL: Return ONLY the JSON object. No markdown, no explanations, no code blocks.
`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    sense_id: { type: "string" },
    word: { type: "string" },
    part_of_speech: { type: "string" },
    primary_definition: { type: "string" },
    collocations: {
      type: "array",
      items: { type: "string" }
    },
    word_family: {
      type: "object",
      properties: {
        noun: { type: "string" },
        verb: { type: "string" },
        adjective: { type: "string" },
        adverb: { type: "string" }
      }
    },
    context_sentence: { type: "string" },
    is_separable: { type: "boolean" }
  },
  required: ["sense_id", "word", "part_of_speech", "primary_definition", "collocations", "word_family", "context_sentence", "is_separable"]
};

// ============================================================================
// GENERATE WORD ENTRY WITH GEMINI
// ============================================================================
async function generateWordEntry(word) {
  console.log(`\n🤖 Generating entry for: "${word}"...`);
  
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseSchema: RESPONSE_SCHEMA,
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent(VOCAB_GENERATION_PROMPT(word));
    const response = await result.response;
    const text = response.text();
    
    const wordData = JSON.parse(text);
    
    console.log(`✅ Generated data for "${word}":`, {
      sense_id: wordData.sense_id,
      part_of_speech: wordData.part_of_speech,
      definition_preview: wordData.primary_definition.substring(0, 60) + '...',
      collocations_count: wordData.collocations.length
    });
    
    return wordData;
    
  } catch (error) {
    console.error(`❌ Failed to generate entry for "${word}":`, error.message);
    throw error;
  }
}

// ============================================================================
// INSERT WORD INTO DATABASE
// ============================================================================
async function insertWordEntry(wordData) {
  const query = `
    INSERT INTO global_words (
      sense_id,
      word,
      part_of_speech,
      primary_definition,
      collocations,
      word_family,
      context_sentence,
      is_separable
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (sense_id) DO UPDATE SET
      primary_definition = EXCLUDED.primary_definition,
      collocations = EXCLUDED.collocations,
      word_family = EXCLUDED.word_family,
      context_sentence = EXCLUDED.context_sentence,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, sense_id, word;
  `;
  
  const values = [
    wordData.sense_id,
    wordData.word,
    wordData.part_of_speech,
    wordData.primary_definition,
    JSON.stringify(wordData.collocations),
    JSON.stringify(wordData.word_family),
    wordData.context_sentence,
    wordData.is_separable
  ];
  
  try {
    const result = await pool.query(query, values);
    console.log(`💾 Inserted into database:`, result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error(`❌ Database insertion failed:`, error.message);
    throw error;
  }
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================
async function seedVocabulary() {
  console.log('🚀 Starting Vocab Lab Seed Script...');
  console.log(`📚 Processing ${AWL_BATCH_1.length} AWL words\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const word of AWL_BATCH_1) {
    try {
      // Generate word data with AI
      const wordData = await generateWordEntry(word);
      
      // Insert into database
      await insertWordEntry(wordData);
      
      successCount++;
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`\n❌ Failed to process "${word}":`, error.message);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEED COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount} words`);
  console.log(`❌ Failed: ${failCount} words`);
  console.log('='.repeat(60) + '\n');
}

// ============================================================================
// RUN SCRIPT
// ============================================================================
seedVocabulary()
  .then(() => {
    console.log('✨ Vocab Lab seed script finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
