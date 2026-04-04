const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

// @route   GET /api/wordbank
// @desc    Fetch all words for the authenticated user
// @access  Private (Student/Teacher/Admin)
router.get('/', auth, async (req, res) => {
  const user_id = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [words] = await connection.query(
      `SELECT id, word, source, created_at 
       FROM user_word_bank 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [user_id]
    );
    res.json(words);
  } catch (err) {
    console.error('DB Error in GET /api/wordbank:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to fetch word bank' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   POST /api/wordbank
// @desc    Add a new word to the user's word bank
// @access  Private (Student/Teacher/Admin)
router.post('/', auth, async (req, res) => {
  const user_id = req.user.id;
  const { word, source } = req.body;

  if (!word || !word.trim()) {
    return res.status(400).json({ error: 'Word is required' });
  }

  const cleanWord = word.trim().toLowerCase();
  const wordSource = source || 'manual';

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO user_word_bank (user_id, word, source) 
       VALUES ($1, $2, $3) 
       RETURNING id, word, source, created_at`,
      [user_id, cleanWord, wordSource]
    );
    return res.status(201).json({
      message: 'Word added to your word bank',
      word: result[0]
    });
  } catch (err) {
    // Handle unique constraint violation (duplicate word)
    if (err.code === '23505' || err.message.includes('unique')) {
      return res.status(200).json({
        message: 'Word already exists in your word bank',
        duplicate: true
      });
    }
    console.error('DB Error in POST /api/wordbank:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to add word to word bank' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   DELETE /api/wordbank/:word_id
// @desc    Delete a specific word from the user's word bank
// @access  Private (Student/Teacher/Admin)
router.delete('/:word_id', auth, async (req, res) => {
  const user_id = req.user.id;
  const { word_id } = req.params;

  if (!word_id || isNaN(word_id)) {
    return res.status(400).json({ error: 'Valid word ID is required' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // USER ISOLATION: Only delete if the word belongs to the authenticated user
    const [result] = await connection.query(
      `DELETE FROM user_word_bank 
       WHERE id = $1 AND user_id = $2`,
      [word_id, user_id]
    );
    const deletedCount = result?.affectedRows ?? result?.rowCount ?? 0;
    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Word not found or access denied' });
    }
    res.json({ message: 'Word removed from your word bank' });
  } catch (err) {
    console.error('DB Error in DELETE /api/wordbank/:word_id:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to delete word from word bank' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
