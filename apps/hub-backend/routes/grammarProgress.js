const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireTeacher = require('../middleware/requireTeacher');
const { pool } = require('../db');

const ERROR_CATEGORIES = [
  'Article Usage',
  'Countability & Plurals',
  'Pronoun Reference',
  'Prepositional Accuracy',
  'Word Forms',
  'Subject-Verb Agreement',
  'Tense Consistency',
  'Present Perfect vs. Past Simple',
  'Gerunds vs. Infinitives',
  'Passive Voice Construction',
  'Sentence Boundaries (Fragments/Comma Splices)',
  'Relative Clauses',
  'Subordination',
  'Word Order',
  'Parallel Structure',
  'Transitional Devices',
  'Collocations',
  'Academic Register',
  'Nominalization',
  'Hedging'
];

function normalizePassedLevels(value, fallbackCurrentLevel = 1) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => Number(entry))
          .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 4)
      )
    ).sort((a, b) => a - b);
  }

  const fallback = Number(fallbackCurrentLevel);
  if (!Number.isInteger(fallback) || fallback <= 1) return [];

  return Array.from({ length: Math.max(0, Math.min(4, fallback - 1)) }, (_, idx) => idx + 1);
}

function normalizeProgressRows(rows) {
  const byCategory = new Map((rows || []).map((row) => [row.error_category, row]));
  return ERROR_CATEGORIES.map((category) => {
    const existing = byCategory.get(category);
    const currentLevel = existing ? Number(existing.current_level) : 1;
    return {
      error_category: category,
      current_level: currentLevel,
      exercises_completed: existing ? Number(existing.exercises_completed) : 0,
      passed_levels: normalizePassedLevels(existing?.passed_levels, currentLevel),
      updated_at: existing?.updated_at || null
    };
  });
}

async function getStudentProgress(connection, studentId) {
  const [rows] = await connection.query(
    `SELECT error_category, current_level, exercises_completed, passed_levels, updated_at
     FROM grammar_progress
     WHERE student_id = $1
     ORDER BY error_category ASC`,
    [studentId]
  );

  return normalizeProgressRows(rows);
}

async function verifyStudentExists(connection, studentId) {
  const [rows] = await connection.query('SELECT id FROM users WHERE id = $1 AND role = $2', [studentId, 'student']);
  return rows.length > 0;
}

// @route   GET api/grammar-progress/my-progress
// @desc    Fetch grammar mastery progress for the current logged-in student
// @access  Private
router.get('/my-progress', auth, async (req, res) => {
  const studentId = Number(req.user.id);

  try {
    const connection = await pool.getConnection();
    const progress = await getStudentProgress(connection, studentId);
    connection.release();
    res.json({ student_id: studentId, progress });
  } catch (error) {
    console.error('Fetch my grammar progress error:', error);
    res.status(500).json({ error: 'Server error fetching grammar progress' });
  }
});

// @route   PUT api/grammar-progress/my-progress/pass-level
// @desc    Mark a grammar level as passed (80%+) and unlock the next level for the current student
// @access  Private
router.put('/my-progress/pass-level', auth, async (req, res) => {
  const studentId = Number(req.user.id);
  const { error_category, passed_level } = req.body;

  if (!ERROR_CATEGORIES.includes(error_category)) {
    return res.status(400).json({ error: 'Invalid error_category. Must be one of the 20 grammar categories.' });
  }

  const passedLevel = Number(passed_level);
  if (!Number.isInteger(passedLevel) || passedLevel < 1 || passedLevel > 4) {
    return res.status(400).json({ error: 'passed_level must be an integer between 1 and 4.' });
  }

  try {
    const connection = await pool.getConnection();

    const [existingRows] = await connection.query(
      `SELECT current_level, exercises_completed, passed_levels
       FROM grammar_progress
       WHERE student_id = $1 AND error_category = $2
       LIMIT 1`,
      [studentId, error_category]
    );

    const existing = existingRows[0] || null;
    const currentLevel = Number(existing?.current_level || 1);
    const existingPassedLevels = normalizePassedLevels(existing?.passed_levels, currentLevel);
    const mergedPassedLevels = Array.from(new Set([...existingPassedLevels, passedLevel])).sort((a, b) => a - b);
    const unlockedLevel = Math.min(4, Math.max(currentLevel, passedLevel + 1));
    const exercisesCompleted = Number(existing?.exercises_completed || 0) + 1;

    await connection.query(
      `INSERT INTO grammar_progress (student_id, error_category, current_level, exercises_completed, passed_levels)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (student_id, error_category)
       DO UPDATE SET
         current_level = EXCLUDED.current_level,
         exercises_completed = EXCLUDED.exercises_completed,
         passed_levels = EXCLUDED.passed_levels,
         updated_at = CURRENT_TIMESTAMP`,
      [studentId, error_category, unlockedLevel, exercisesCompleted, JSON.stringify(mergedPassedLevels)]
    );

    const progress = await getStudentProgress(connection, studentId);
    connection.release();

    const progressEntry = progress.find((entry) => entry.error_category === error_category) || null;
    res.json({ success: true, student_id: studentId, progress_entry: progressEntry, progress });
  } catch (error) {
    console.error('Mark passed grammar level error:', error);
    res.status(500).json({ error: 'Server error saving passed grammar level' });
  }
});

// @route   PUT api/grammar-progress/my-progress
// @desc    Upsert a grammar category progress row for current logged-in student
// @access  Private
router.put('/my-progress', auth, async (req, res) => {
  const studentId = Number(req.user.id);
  const { error_category, current_level, exercises_completed, passed_levels } = req.body;

  if (!ERROR_CATEGORIES.includes(error_category)) {
    return res.status(400).json({ error: 'Invalid error_category. Must be one of the 20 grammar categories.' });
  }

  const levelNum = Number(current_level);
  const completedNum = Number(exercises_completed);

  if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 4) {
    return res.status(400).json({ error: 'current_level must be an integer between 1 and 4.' });
  }

  if (!Number.isInteger(completedNum) || completedNum < 0) {
    return res.status(400).json({ error: 'exercises_completed must be a non-negative integer.' });
  }

  if (passed_levels != null && !Array.isArray(passed_levels)) {
    return res.status(400).json({ error: 'passed_levels must be an array of integers between 1 and 4.' });
  }

  const normalizedPassedLevels = passed_levels == null ? null : normalizePassedLevels(passed_levels, levelNum);

  try {
    const connection = await pool.getConnection();

    await connection.query(
      `INSERT INTO grammar_progress (student_id, error_category, current_level, exercises_completed, passed_levels)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (student_id, error_category)
       DO UPDATE SET
         current_level = EXCLUDED.current_level,
         exercises_completed = EXCLUDED.exercises_completed,
         passed_levels = COALESCE(EXCLUDED.passed_levels, grammar_progress.passed_levels),
         updated_at = CURRENT_TIMESTAMP`,
      [studentId, error_category, levelNum, completedNum, normalizedPassedLevels == null ? null : JSON.stringify(normalizedPassedLevels)]
    );

    const progress = await getStudentProgress(connection, studentId);
    connection.release();

    res.json({ success: true, student_id: studentId, progress });
  } catch (error) {
    console.error('Update my grammar progress error:', error);
    res.status(500).json({ error: 'Server error updating grammar progress' });
  }
});

// @route   GET api/grammar-progress/student/:id
// @desc    Fetch grammar mastery progress for a specific student
// @access  Private (Teacher/Admin)
router.get('/student/:id', requireTeacher, async (req, res) => {
  const studentId = Number(req.params.id);

  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: 'Invalid student id.' });
  }

  try {
    const connection = await pool.getConnection();

    const exists = await verifyStudentExists(connection, studentId);
    if (!exists) {
      connection.release();
      return res.status(404).json({ error: 'Student not found.' });
    }

    const progress = await getStudentProgress(connection, studentId);
    connection.release();

    res.json({ student_id: studentId, progress });
  } catch (error) {
    console.error('Fetch student grammar progress error:', error);
    res.status(500).json({ error: 'Server error fetching grammar progress' });
  }
});

// @route   PUT api/grammar-progress/student/:id
// @desc    Teacher/Admin upsert a grammar category progress row for a student
// @access  Private (Teacher/Admin)
router.put('/student/:id', requireTeacher, async (req, res) => {
  const studentId = Number(req.params.id);
  const { error_category, current_level, exercises_completed, passed_levels } = req.body;

  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: 'Invalid student id.' });
  }

  if (!ERROR_CATEGORIES.includes(error_category)) {
    return res.status(400).json({ error: 'Invalid error_category. Must be one of the 20 grammar categories.' });
  }

  const levelNum = Number(current_level);
  const completedNum = Number(exercises_completed);

  if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 4) {
    return res.status(400).json({ error: 'current_level must be an integer between 1 and 4.' });
  }

  if (!Number.isInteger(completedNum) || completedNum < 0) {
    return res.status(400).json({ error: 'exercises_completed must be a non-negative integer.' });
  }

  if (passed_levels != null && !Array.isArray(passed_levels)) {
    return res.status(400).json({ error: 'passed_levels must be an array of integers between 1 and 4.' });
  }

  const normalizedPassedLevels = passed_levels == null ? null : normalizePassedLevels(passed_levels, levelNum);

  try {
    const connection = await pool.getConnection();

    const exists = await verifyStudentExists(connection, studentId);
    if (!exists) {
      connection.release();
      return res.status(404).json({ error: 'Student not found.' });
    }

    await connection.query(
      `INSERT INTO grammar_progress (student_id, error_category, current_level, exercises_completed, passed_levels)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (student_id, error_category)
       DO UPDATE SET
         current_level = EXCLUDED.current_level,
         exercises_completed = EXCLUDED.exercises_completed,
         passed_levels = COALESCE(EXCLUDED.passed_levels, grammar_progress.passed_levels),
         updated_at = CURRENT_TIMESTAMP`,
      [studentId, error_category, levelNum, completedNum, normalizedPassedLevels == null ? null : JSON.stringify(normalizedPassedLevels)]
    );

    const progress = await getStudentProgress(connection, studentId);
    connection.release();

    res.json({ success: true, student_id: studentId, progress });
  } catch (error) {
    console.error('Update student grammar progress error:', error);
    res.status(500).json({ error: 'Server error updating grammar progress' });
  }
});

module.exports = router;
