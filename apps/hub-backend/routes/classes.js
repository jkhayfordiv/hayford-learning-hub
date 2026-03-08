const express = require('express');
const router = express.Router();
const requireTeacher = require('../middleware/requireTeacher');
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   POST api/classes
// @desc    Create a new class
// @access  Private (Teacher only)
router.post('/', requireTeacher, async (req, res) => {
  const { class_name } = req.body;
  const teacher_id = req.user.id;
  
  if (!class_name) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    const class_code = require('crypto').randomBytes(3).toString('hex').toUpperCase();

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO classes (class_name, class_code, teacher_id) VALUES (?, ?, ?)',
      [class_name, class_code, teacher_id]
    );
    
    connection.release();
    res.status(201).json({ success: true, message: 'Class created', id: result.insertId, class_code });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Server error creating class' });
  }
});

// @route   GET api/classes
// @desc    Get classes (for teacher: their created classes, for student: their enrolled class)
// @access  Private
router.get('/', auth, async (req, res) => {
  const user_id = req.user.id;
  const role = req.user.role;

  try {
    const connection = await pool.getConnection();
    
    if (role === 'teacher' || role === 'admin') {
      const [classes] = await connection.query(
        'SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC',
        [user_id]
      );
      connection.release();
      return res.json(classes);
    } else {
      // Student
      const [userRows] = await connection.query('SELECT class_id FROM users WHERE id = ?', [user_id]);
      if (userRows.length > 0 && userRows[0].class_id) {
        const [classInfo] = await connection.query('SELECT * FROM classes WHERE id = ?', [userRows[0].class_id]);
        connection.release();
        return res.json(classInfo);
      }
      connection.release();
      return res.json([]);
    }
  } catch (error) {
    console.error('Fetch classes error:', error);
    res.status(500).json({ error: 'Server error fetching classes' });
  }
});

// @route   POST api/classes/join
// @desc    Join a class using a code
// @access  Private (Student only)
router.post('/join', auth, async (req, res) => {
  const { class_code } = req.body;
  const user_id = req.user.id;

  if (!class_code) {
    return res.status(400).json({ error: 'Class code is required' });
  }

  try {
    const connection = await pool.getConnection();
    // Codes are generated as uppercase hex
    const [classes] = await connection.query('SELECT id FROM classes WHERE class_code = ?', [class_code.toUpperCase()]);
    
    if (classes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Invalid class code' });
    }

    const class_id = classes[0].id;
    await connection.query('UPDATE users SET class_id = ? WHERE id = ?', [class_id, user_id]);
    
    connection.release();
    res.json({ success: true, message: 'Successfully joined class', class_id });
  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({ error: 'Server error joining class' });
  }
});

module.exports = router;
