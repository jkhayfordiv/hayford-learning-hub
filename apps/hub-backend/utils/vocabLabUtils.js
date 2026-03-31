/**
 * Shared utilities for the Vocab Lab:
 *   ensureWordInGlobalWords — lookup + AI generation + DB insert
 *   addWordToUserVocab      — insert into user_vocabulary, duplicate-safe
 */

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Gemini schema for word generation ───────────────────────────────────────
const WORD_GEN_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    is_valid_english:   { type: SchemaType.BOOLEAN },
    sense_id:           { type: SchemaType.STRING },
    word:               { type: SchemaType.STRING },
    part_of_speech:     { type: SchemaType.STRING },
    primary_definition: { type: SchemaType.STRING },
    collocations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    word_family: {
      type: SchemaType.OBJECT,
      properties: {
        noun:      { type: SchemaType.STRING },
        verb:      { type: SchemaType.STRING },
        adjective: { type: SchemaType.STRING },
        adverb:    { type: SchemaType.STRING },
      },
    },
    context_sentence: { type: SchemaType.STRING },
    is_separable:     { type: SchemaType.BOOLEAN },
  },
  required: [
    'is_valid_english', 'word', 'part_of_speech',
    'primary_definition', 'context_sentence', 'is_separable',
  ],
};

// ─── ensureWordInGlobalWords ──────────────────────────────────────────────────
/**
 * Looks up `wordStr` in global_words (case-insensitive).
 * If not found, generates the entry with Gemini and inserts it.
 * Returns the matching row(s) from global_words as an array.
 *
 * Throws an Error with `.code`:
 *   'INVALID_WORD'      — Gemini says input is not a real English word
 *   'GENERATION_FAILED' — Gemini response could not be parsed
 */
async function ensureWordInGlobalWords(connection, wordStr) {
  const cleanWord = wordStr.trim().toLowerCase();

  const [existing] = await connection.query(
    `SELECT id, sense_id, word, part_of_speech, primary_definition
     FROM global_words
     WHERE LOWER(word) = $1
     ORDER BY sense_id ASC`,
    [cleanWord]
  );

  if (existing.length > 0) return existing;

  // ── Not in dictionary — call Gemini ────────────────────────────────────────
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseSchema: WORD_GEN_SCHEMA,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are an EAP (English for Academic Purposes) dictionary editor.

Generate the dictionary entry for the English word or phrase: "${wordStr.trim()}"

If the input is NOT a real English word (e.g. gibberish, typo), set is_valid_english to false.
If it IS a valid English word, set is_valid_english to true and fill all fields accurately.

Guidelines:
- sense_id format: "word_pos_01" (e.g. "analyse_v_01"). Use the first letter of part_of_speech.
- Focus on the primary ACADEMIC sense of the word.
- collocations: 4-6 common academic collocations as short phrases.
- word_family: only include forms that actually exist in English.
- context_sentence: one natural, academic-register example sentence.`;

  let parsed;
  try {
    const result = await model.generateContent(prompt);
    parsed = JSON.parse(result.response.text());
  } catch (e) {
    const err = new Error(`Could not generate entry for "${wordStr}". Please check the spelling.`);
    err.code = 'GENERATION_FAILED';
    throw err;
  }

  if (!parsed.is_valid_english) {
    const err = new Error(`"${wordStr}" does not appear to be a valid English word.`);
    err.code = 'INVALID_WORD';
    throw err;
  }

  const senseId = (parsed.sense_id || '').trim()
    || `${cleanWord.replace(/\s+/g, '_')}_${(parsed.part_of_speech || 'x')[0].toLowerCase()}_01`;

  const [inserted] = await connection.query(
    `INSERT INTO global_words
       (sense_id, word, part_of_speech, primary_definition, collocations, word_family, context_sentence, is_separable)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (sense_id) DO UPDATE SET
       primary_definition = EXCLUDED.primary_definition,
       collocations       = EXCLUDED.collocations,
       word_family        = EXCLUDED.word_family,
       context_sentence   = EXCLUDED.context_sentence,
       updated_at         = CURRENT_TIMESTAMP
     RETURNING id, sense_id, word, part_of_speech, primary_definition`,
    [
      senseId,
      (parsed.word || cleanWord).toLowerCase(),
      parsed.part_of_speech,
      parsed.primary_definition,
      JSON.stringify(parsed.collocations || []),
      JSON.stringify(parsed.word_family || {}),
      parsed.context_sentence,
      parsed.is_separable || false,
    ]
  );

  console.log(`[vocabLabUtils] AI-generated and inserted: "${cleanWord}" (${senseId})`);
  return inserted;
}

// ─── addWordToUserVocab ───────────────────────────────────────────────────────
/**
 * Inserts a word into a user's vocabulary at SRS level 0.
 * Silently ignores duplicates (unique constraint violations).
 * Returns { added: boolean }
 */
async function addWordToUserVocab(connection, userId, globalWordId) {
  try {
    await connection.query(
      `INSERT INTO user_vocabulary (user_id, global_word_id, srs_level, next_review_date)
       VALUES ($1, $2, 0, CURRENT_TIMESTAMP)`,
      [userId, globalWordId]
    );
    return { added: true };
  } catch (err) {
    if (err.code === '23505') return { added: false };
    throw err;
  }
}

module.exports = { ensureWordInGlobalWords, addWordToUserVocab };
