const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const requireTeacher = require('../middleware/requireTeacher');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { ensureWordInGlobalWords, addWordToUserVocab } = require('../utils/vocabLabUtils');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const GRADE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    word_used_correctly: { type: SchemaType.BOOLEAN },
    grammar_acceptable:  { type: SchemaType.BOOLEAN },
    feedback_text:       { type: SchemaType.STRING },
  },
  required: ['word_used_correctly', 'grammar_acceptable', 'feedback_text'],
};

// SRS interval schedule (days per level)
const SRS_INTERVALS = {
  0: 1,   // Level 0 → 1: review again in 1 day
  1: 3,   // Level 1 → 2: review in 3 days
  2: 7,   // Level 2 → 3: review in 1 week
  3: 14,  // Level 3 → 4: review in 2 weeks
  4: 30,  // Level 4 → 5: review in 1 month
  5: 60,  // Level 5+: mastered, review every 2 months
};

function getNextReviewDate(newLevel) {
  const days = SRS_INTERVALS[Math.min(newLevel, 5)] || 60;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// ============================================================================
// GET /api/vocab-lab/dashboard
// Returns due_today, starred_words, and stats for the authenticated user
// ============================================================================
router.get('/dashboard', auth, async (req, res) => {
  const user_id = req.user.id;
  const connection = await pool.getConnection();

  try {
    // Words due today (next_review_date <= NOW() or never reviewed yet)
    const [dueTodayRows] = await connection.query(
      `SELECT
         uv.id            AS user_word_id,
         uv.srs_level,
         uv.next_review_date,
         uv.is_starred,
         uv.last_reviewed_at,
         gw.id            AS global_word_id,
         gw.sense_id,
         gw.word,
         gw.part_of_speech,
         gw.primary_definition,
         gw.collocations,
         gw.word_family,
         gw.context_sentence
       FROM user_vocabulary uv
       JOIN global_words gw ON gw.id = uv.global_word_id
       WHERE uv.user_id = $1
         AND uv.next_review_date <= CURRENT_TIMESTAMP
       ORDER BY uv.next_review_date ASC`,
      [user_id]
    );

    // Starred words (regardless of due date)
    const [starredRows] = await connection.query(
      `SELECT
         uv.id            AS user_word_id,
         uv.srs_level,
         uv.next_review_date,
         uv.is_starred,
         uv.last_reviewed_at,
         gw.id            AS global_word_id,
         gw.sense_id,
         gw.word,
         gw.part_of_speech,
         gw.primary_definition,
         gw.collocations,
         gw.word_family,
         gw.context_sentence
       FROM user_vocabulary uv
       JOIN global_words gw ON gw.id = uv.global_word_id
       WHERE uv.user_id = $1
         AND uv.is_starred = true
       ORDER BY gw.word ASC`,
      [user_id]
    );

    // All user words (any due date) — for sandbox practice modes
    const [allWordsRows] = await connection.query(
      `SELECT
         uv.id            AS user_word_id,
         uv.srs_level,
         uv.next_review_date,
         uv.is_starred,
         gw.id            AS global_word_id,
         gw.sense_id,
         gw.word,
         gw.part_of_speech,
         gw.primary_definition,
         gw.collocations,
         gw.word_family,
         gw.context_sentence
       FROM user_vocabulary uv
       JOIN global_words gw ON gw.id = uv.global_word_id
       WHERE uv.user_id = $1
       ORDER BY uv.srs_level ASC, gw.word ASC`,
      [user_id]
    );

    // Mastered words (srs_level >= 5) — for voluntary review sessions
    const [masteredRows] = await connection.query(
      `SELECT
         uv.id            AS user_word_id,
         uv.srs_level,
         uv.next_review_date,
         uv.is_starred,
         uv.last_reviewed_at,
         gw.id            AS global_word_id,
         gw.sense_id,
         gw.word,
         gw.part_of_speech,
         gw.primary_definition,
         gw.collocations,
         gw.word_family,
         gw.context_sentence
       FROM user_vocabulary uv
       JOIN global_words gw ON gw.id = uv.global_word_id
       WHERE uv.user_id = $1
         AND uv.srs_level >= 5
       ORDER BY gw.word ASC`,
      [user_id]
    );

    // Stats: mastered (srs_level >= 5) and total learning
    const [statsRows] = await connection.query(
      `SELECT
         COUNT(*) FILTER (WHERE srs_level >= 5)  AS total_mastered,
         COUNT(*) FILTER (WHERE srs_level < 5)   AS total_learning,
         COUNT(*)                                  AS total_words
       FROM user_vocabulary
       WHERE user_id = $1`,
      [user_id]
    );

    connection.release();

    const stats = statsRows[0] || { total_mastered: 0, total_learning: 0, total_words: 0 };

    res.json({
      due_today:     dueTodayRows,
      starred_words: starredRows,
      all_words:     allWordsRows,
      mastered_words: masteredRows,
      stats: {
        total_mastered: parseInt(stats.total_mastered, 10),
        total_learning: parseInt(stats.total_learning, 10),
        total_words:    parseInt(stats.total_words, 10),
      },
    });
  } catch (err) {
    connection.release();
    console.error('Error in GET /api/vocab-lab/dashboard:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================================================
// POST /api/vocab-lab/add
// Adds a word to the user's SRS list from the global dictionary
// ============================================================================
router.post('/add', auth, async (req, res) => {
  const user_id = req.user.id;
  const { word, sense_id } = req.body;

  if (!word && !sense_id) {
    return res.status(400).json({ error: 'Either word or sense_id is required' });
  }

  const connection = await pool.getConnection();

  try {
    let globalWordRows;

    if (sense_id) {
      // Direct lookup by sense_id
      [globalWordRows] = await connection.query(
        `SELECT id, sense_id, word, part_of_speech, primary_definition
         FROM global_words
         WHERE sense_id = $1`,
        [sense_id]
      );
    } else {
      // Search by word (case-insensitive) — may return multiple senses
      [globalWordRows] = await connection.query(
        `SELECT id, sense_id, word, part_of_speech, primary_definition
         FROM global_words
         WHERE LOWER(word) = LOWER($1)
         ORDER BY sense_id ASC`,
        [word.trim()]
      );
    }

    if (globalWordRows.length === 0) {
      if (sense_id) {
        // sense_id lookups can't fall back to AI — the sense must already exist
        connection.release();
        return res.status(404).json({ error: `Sense "${sense_id}" was not found in the dictionary.` });
      }
      // ── AI fallback: generate the word on-the-fly ────────────────────────────
      try {
        globalWordRows = await ensureWordInGlobalWords(connection, word);
      } catch (genErr) {
        connection.release();
        if (genErr.code === 'INVALID_WORD') {
          return res.status(400).json({ error: genErr.message });
        }
        return res.status(400).json({ error: genErr.message || `Failed to generate entry for "${word}". Check the spelling.` });
      }
    }

    // Multiple senses found — ask frontend to disambiguate
    if (globalWordRows.length > 1 && !sense_id) {
      connection.release();
      return res.status(206).json({
        message: 'Multiple senses found. Please choose one.',
        options: globalWordRows,
      });
    }

    const globalWord = globalWordRows[0];

    // Insert into user_vocabulary (handle duplicate gracefully)
    try {
      const [result] = await connection.query(
        `INSERT INTO user_vocabulary (user_id, global_word_id, srs_level, next_review_date)
         VALUES ($1, $2, 0, CURRENT_TIMESTAMP)
         RETURNING id, srs_level, next_review_date, is_starred, created_at`,
        [user_id, globalWord.id]
      );

      connection.release();

      return res.status(201).json({
        message: `"${globalWord.word}" added to your Vocab Lab`,
        user_vocabulary: result[0],
        global_word: globalWord,
      });
    } catch (insertErr) {
      // Unique constraint violation — word already in user's list
      if (insertErr.code === '23505') {
        connection.release();
        return res.status(200).json({
          message: `"${globalWord.word}" is already in your Vocab Lab`,
          duplicate: true,
        });
      }
      throw insertErr; // outer catch will release
    }
  } catch (err) {
    connection.release();
    console.error('Error in POST /api/vocab-lab/add:', err.message);
    res.status(500).json({ error: 'Failed to add word to Vocab Lab' });
  }
});

// ============================================================================
// PATCH /api/vocab-lab/words/:id/star
// Toggles is_starred on a user_vocabulary entry
// ============================================================================
router.patch('/words/:id/star', auth, async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `UPDATE user_vocabulary
       SET is_starred = NOT is_starred
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_starred`,
      [id, user_id]
    );
    connection.release();
    if (!rows.length) return res.status(404).json({ error: 'Word not found' });
    return res.json({ id: rows[0].id, is_starred: rows[0].is_starred });
  } catch (err) {
    connection.release();
    console.error('Error in PATCH /api/vocab-lab/words/:id/star:', err.message);
    res.status(500).json({ error: 'Failed to toggle star' });
  }
});

// ============================================================================
// PATCH /api/vocab-lab/words/:id/reset
// Resets a word's SRS level back to 0 (re-queues for learning)
// ============================================================================
router.patch('/words/:id/reset', auth, async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `UPDATE user_vocabulary
       SET srs_level = 0, next_review_date = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id, srs_level, next_review_date`,
      [id, user_id]
    );
    connection.release();
    if (!rows.length) return res.status(404).json({ error: 'Word not found' });
    return res.json({ id: rows[0].id, srs_level: rows[0].srs_level });
  } catch (err) {
    connection.release();
    console.error('Error in PATCH /api/vocab-lab/words/:id/reset:', err.message);
    res.status(500).json({ error: 'Failed to reset word' });
  }
});

// ============================================================================
// DELETE /api/vocab-lab/words/:id
// Removes a word entirely from the user's vocabulary
// ============================================================================
router.delete('/words/:id', auth, async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `DELETE FROM user_vocabulary
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, user_id]
    );
    connection.release();
    if (!rows.length) return res.status(404).json({ error: 'Word not found' });
    return res.json({ deleted: true, id: rows[0].id });
  } catch (err) {
    connection.release();
    console.error('Error in DELETE /api/vocab-lab/words/:id:', err.message);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// ============================================================================
// POST /api/vocab-lab/review
// Updates SRS level after a student reviews a word
// ============================================================================
router.post('/review', auth, async (req, res) => {
  const user_id = req.user.id;
  const { user_word_id, is_correct } = req.body;

  if (!user_word_id || is_correct === undefined) {
    return res.status(400).json({ error: 'user_word_id and is_correct are required' });
  }

  const connection = await pool.getConnection();

  try {
    // Fetch current row — enforce user ownership
    const [rows] = await connection.query(
      `SELECT id, srs_level
       FROM user_vocabulary
       WHERE id = $1 AND user_id = $2`,
      [user_word_id, user_id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Word not found or access denied' });
    }

    const current = rows[0];
    let newLevel;
    let nextReviewDate;

    if (is_correct) {
      newLevel = Math.min(current.srs_level + 1, 10); // Cap at 10
      nextReviewDate = getNextReviewDate(newLevel);
    } else {
      newLevel = 0;
      nextReviewDate = new Date(); // Due immediately
    }

    const [updateResult] = await connection.query(
      `UPDATE user_vocabulary
       SET srs_level       = $1,
           next_review_date = $2,
           last_reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING id, srs_level, next_review_date, last_reviewed_at`,
      [newLevel, nextReviewDate.toISOString(), user_word_id, user_id]
    );

    connection.release();

    const updated = updateResult[0];
    const isNowMastered = newLevel >= 5;

    res.json({
      message: is_correct
        ? (isNowMastered ? '🏆 Word mastered!' : `✅ Correct! SRS level → ${newLevel}`)
        : `❌ Incorrect. Back to level 0 — review again soon`,
      srs_level:        updated.srs_level,
      next_review_date: updated.next_review_date,
      last_reviewed_at: updated.last_reviewed_at,
      is_mastered:      isNowMastered,
    });
  } catch (err) {
    connection.release();
    console.error('Error in POST /api/vocab-lab/review:', err.message);
    res.status(500).json({ error: 'Failed to update review result' });
  }
});

// ============================================================================
// PATCH /api/vocab-lab/star/:user_word_id
// Toggle starred status for a word in the user's Vocab Lab
// ============================================================================
router.patch('/star/:user_word_id', auth, async (req, res) => {
  const user_id = req.user.id;
  const { user_word_id } = req.params;

  const connection = await pool.getConnection();

  try {
    const [result] = await connection.query(
      `UPDATE user_vocabulary
       SET is_starred = NOT is_starred
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_starred`,
      [user_word_id, user_id]
    );

    connection.release();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Word not found or access denied' });
    }

    res.json({
      message: result[0].is_starred ? 'Word starred' : 'Star removed',
      is_starred: result[0].is_starred,
    });
  } catch (err) {
    connection.release();
    console.error('Error in PATCH /api/vocab-lab/star:', err.message);
    res.status(500).json({ error: 'Failed to update star status' });
  }
});

// ============================================================================
// POST /api/vocab-lab/assign
// Teacher/Admin: push a list of words into each target student's Vocab Lab
// Body: { words: string[], student_id?: number, class_id?: number }
// ============================================================================
router.post('/assign', requireTeacher, async (req, res) => {
  const teacher_id = req.user.id;
  const actor_role = req.user.role;
  const { words, student_id, class_id } = req.body;

  if (!words || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'words must be a non-empty array of strings' });
  }
  if (!student_id && !class_id) {
    return res.status(400).json({ error: 'Either student_id or class_id is required' });
  }

  const connection = await pool.getConnection();

  try {
    // ── Resolve target students ───────────────────────────────────────────────
    let students;
    if (student_id) {
      students = [{ id: parseInt(student_id, 10) }];
    } else {
      // Verify class access
      const [classRows] = await connection.query(
        `SELECT id, teacher_id, institution_id FROM classes WHERE id = $1`,
        [class_id]
      );
      if (classRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Class not found.' });
      }
      const classInfo = classRows[0];
      if (actor_role === 'teacher' && Number(classInfo.teacher_id) !== Number(teacher_id)) {
        connection.release();
        return res.status(403).json({ error: 'You can only assign to your own classes.' });
      }

      const [studentRows] = await connection.query(
        `SELECT u.id FROM users u
         JOIN class_enrollments ce ON u.id = ce.user_id
         WHERE ce.class_id = $1 AND u.role = 'student'`,
        [class_id]
      );
      students = studentRows;
    }

    if (students.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'No students found for this target.' });
    }

    // ── Process each word ─────────────────────────────────────────────────────
    const results = [];
    for (const wordStr of words) {
      if (!wordStr || !wordStr.trim()) continue;
      try {
        const globalWordRows = await ensureWordInGlobalWords(connection, wordStr);
        const globalWord = globalWordRows[0];
        let addedCount = 0;
        for (const student of students) {
          const { added } = await addWordToUserVocab(connection, student.id, globalWord.id);
          if (added) addedCount++;
        }
        results.push({ word: globalWord.word, added_to: addedCount, status: 'ok' });
      } catch (genErr) {
        results.push({ word: wordStr, status: 'error', reason: genErr.message });
      }
    }

    connection.release();
    const okCount = results.filter(r => r.status === 'ok').length;
    res.status(200).json({
      message: `Vocab assignment complete. ${okCount}/${results.length} word(s) processed for ${students.length} student(s).`,
      results,
    });
  } catch (err) {
    connection.release();
    console.error('Error in POST /api/vocab-lab/assign:', err.message);
    res.status(500).json({ error: 'Failed to assign vocabulary' });
  }
});

// ============================================================================
// POST /api/vocab-lab/grade
// Grades a student's sentence for Mode B (Sentence Builder) using Gemini AI
// ============================================================================
router.post('/grade', auth, async (req, res) => {
  const user_id = req.user.id;
  const { user_word_id, sentence } = req.body;

  if (!user_word_id || !sentence || !sentence.trim()) {
    return res.status(400).json({ error: 'user_word_id and sentence are required' });
  }

  const connection = await pool.getConnection();

  try {
    // Fetch word data — enforce user ownership
    const [rows] = await connection.query(
      `SELECT uv.id, uv.srs_level, gw.word, gw.part_of_speech, gw.primary_definition
       FROM user_vocabulary uv
       JOIN global_words gw ON gw.id = uv.global_word_id
       WHERE uv.id = $1 AND uv.user_id = $2`,
      [user_word_id, user_id]
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Word not found or access denied' });
    }

    const { word, part_of_speech, primary_definition } = rows[0];

    const prompt = `You are an English language tutor evaluating an EAP (English for Academic Purposes) student.

Target vocabulary word: "${word}" (${part_of_speech})
Definition: "${primary_definition}"
Student's sentence: "${sentence}"

Evaluate:
1. Did the student use the word "${word}" correctly in terms of meaning and grammar?
2. Is the overall grammar of the sentence acceptable for an intermediate EAP learner?

Keep your feedback_text to 1-2 encouraging sentences appropriate for a language learner.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseSchema: GRADE_SCHEMA,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    res.json({
      word_used_correctly: parsed.word_used_correctly,
      grammar_acceptable:  parsed.grammar_acceptable,
      feedback_text:       parsed.feedback_text,
      is_correct:          parsed.word_used_correctly,
    });
  } catch (err) {
    if (connection) connection.release();
    console.error('Error in POST /api/vocab-lab/grade:', err.message);
    res.status(500).json({ error: 'Failed to grade sentence' });
  }
});

// ============================================================================
// POST /api/vocab-lab/generate-quiz
// Generates a 5-question multiple-choice quiz from the user's starred words
// ============================================================================
const QUIZ_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    quiz: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question:       { type: SchemaType.STRING },
          options:        { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          correct_answer: { type: SchemaType.STRING },
          explanation:    { type: SchemaType.STRING },
        },
        required: ['question', 'options', 'correct_answer', 'explanation'],
      },
    },
  },
  required: ['quiz'],
};

router.post('/generate-quiz', auth, async (req, res) => {
  const user_id = req.user.id;
  const connection = await pool.getConnection();
  try {
    const [starred] = await connection.query(
      `SELECT uv.id AS user_word_id, gw.word, gw.part_of_speech, gw.primary_definition, gw.context_sentence
       FROM user_vocabulary uv
       JOIN global_words gw ON gw.id = uv.global_word_id
       WHERE uv.user_id = $1 AND uv.is_starred = true
       ORDER BY RANDOM()
       LIMIT 5`,
      [user_id]
    );
    connection.release();

    if (starred.length < 5) {
      return res.status(400).json({
        error: 'You need at least 5 starred words to generate a quiz.',
      });
    }

    const wordList = starred.map(w => `"${w.word}" (${w.part_of_speech}): ${w.primary_definition}`).join('\n');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseSchema: QUIZ_SCHEMA,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `You are an EFL vocabulary quiz creator for A2-B1 English learners.

Create a 5-question multiple-choice vocabulary quiz using EXACTLY these 5 target words (one question per word):
${wordList}

For each question:
- Write a simple fill-in-the-blank sentence at A2-B1 CEFR level (under 15 words, basic grammar).
- The blank (______) replaces the target word in the sentence.
- Provide exactly 4 options: the 1 correct answer and 3 plausible distractor words of the same part of speech.
- Write a short, friendly explanation (1 sentence) of why the correct answer is right.

Return a JSON object with a "quiz" array of exactly 5 items.`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    res.json({ quiz: parsed.quiz || [] });
  } catch (err) {
    if (connection) connection.release();
    console.error('Error in POST /api/vocab-lab/generate-quiz:', err.message);
    res.status(500).json({ error: 'Failed to generate quiz. Please try again.' });
  }
});

// ============================================================================
// POST /api/vocab-lab/import-assignment/:assignmentId
// Auto-imports vocabulary words from an assignment into the student's SRS queue
// ============================================================================
router.post('/import-assignment/:assignmentId', auth, async (req, res) => {
  const user_id = req.user.id;
  const assignment_id = req.params.assignmentId;

  const connection = await pool.getConnection();
  try {
    // 1. Verify the assignment belongs to this student and is a vocabulary type
    const [taskRows] = await connection.query(
      `SELECT id, assignment_type, vocab_words, status
       FROM assigned_tasks
       WHERE id = $1 AND student_id = $2`,
      [assignment_id, user_id]
    );

    if (taskRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Assignment not found or access denied' });
    }

    const task = taskRows[0];
    if (task.assignment_type !== 'vocabulary') {
      connection.release();
      return res.status(400).json({ error: 'This is not a vocabulary assignment' });
    }

    // 2. Parse vocab_words (could be JSON array of words or comma-separated string)
    let words = [];
    if (task.vocab_words) {
      try {
        words = typeof task.vocab_words === 'string' 
          ? JSON.parse(task.vocab_words) 
          : task.vocab_words;
      } catch (_) {
        // Try comma-separated fallback
        words = task.vocab_words.split(',').map(w => w.trim()).filter(Boolean);
      }
    }

    if (!Array.isArray(words) || words.length === 0) {
      connection.release();
      return res.json({ 
        message: 'No words to import from this assignment',
        imported: 0,
        skipped: 0
      });
    }

    // 3. For each word, ensure it exists in global_words and add to user_vocabulary
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const wordStr of words) {
      try {
        // Ensure word exists in global_words (will generate via AI if needed)
        const globalWordRows = await ensureWordInGlobalWords(connection, wordStr);
        
        if (globalWordRows.length > 0) {
          // Add first sense to user's vocabulary at SRS level 0
          const result = await addWordToUserVocab(connection, user_id, globalWordRows[0].id);
          if (result.added) {
            imported++;
          } else {
            skipped++; // Already in user's vocabulary
          }
        }
      } catch (err) {
        console.error(`[vocab-lab] Failed to import word "${wordStr}":`, err.message);
        errors.push({ word: wordStr, error: err.message });
        skipped++;
      }
    }

    // 4. Mark assignment as completed if all words were processed
    if (imported > 0 || skipped === words.length) {
      await connection.query(
        `UPDATE assigned_tasks SET status = 'completed' WHERE id = $1`,
        [assignment_id]
      );
    }

    connection.release();
    res.json({
      message: `Imported ${imported} word(s) to your vocabulary queue`,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    if (connection) connection.release();
    console.error('Error in POST /api/vocab-lab/import-assignment:', err.message);
    res.status(500).json({ error: 'Failed to import assignment words' });
  }
});

module.exports = router;
