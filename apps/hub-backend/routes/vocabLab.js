const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

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
      connection.release();
      return res.status(404).json({ error: `"${word || sense_id}" was not found in the vocabulary dictionary` });
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
      connection.release();

      // Unique constraint violation — word already in user's list
      if (insertErr.code === '23505') {
        return res.status(200).json({
          message: `"${globalWord.word}" is already in your Vocab Lab`,
          duplicate: true,
        });
      }
      throw insertErr;
    }
  } catch (err) {
    connection.release();
    console.error('Error in POST /api/vocab-lab/add:', err.message);
    res.status(500).json({ error: 'Failed to add word to Vocab Lab' });
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

module.exports = router;
