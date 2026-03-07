const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   POST api/scores
// @desc    Submit a new score and AI feedback for a student
// @access  Private
router.post('/', auth, async (req, res) => {
  const { submitted_text, word_count, overall_score, ai_feedback, diagnostic_tags, taskId, module_type } = req.body;
  const student_id = req.user.id;
  const type = module_type || 'writing';

  try {
    const connection = await pool.getConnection();

    let module_id = 1;

    if (type === 'vocabulary') {
      // Check if vocabulary module exists, else create it
      const [vocabModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'vocabulary' LIMIT 1");
      if (vocabModules.length === 0) {
        const [insertRes] = await connection.query(
          "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('Vocabulary Builder', 'vocabulary', 'Practice vocabulary in sentences.')"
        );
        module_id = insertRes.insertId;
      } else {
        module_id = vocabModules[0].id;
      }
    } else {
      // Ensure the default Writing module exists
      const [modules] = await connection.query('SELECT id FROM learning_modules WHERE id = 1');
      if (modules.length === 0) {
        await connection.query(
          "INSERT INTO learning_modules (id, module_name, module_type, description) VALUES (1, 'IELTS Task 1 Academic', 'writing', 'Describe visual data in 150+ words.')"
        );
      }
    }

    // Insert score
    const [result] = await connection.query(
      `INSERT INTO student_scores 
       (student_id, module_id, submitted_text, word_count, overall_score, ai_feedback, diagnostic_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id, module_id, submitted_text, word_count, overall_score, JSON.stringify(ai_feedback), JSON.stringify(diagnostic_tags || [])]
    );

    // If a taskId was provided, mark the assignment as completed
    if (taskId) {
       await connection.query(
         `UPDATE assigned_tasks SET status = 'completed' WHERE id = ? AND student_id = ?`,
         [taskId, student_id]
       );
    }

    connection.release();
    res.status(201).json({ 
      success: true, 
      message: 'Score saved successfully!',
      score_id: result.insertId 
    });

  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ error: 'Server Error writing to database' });
  }
});

// @route   GET api/scores/my-scores
// @desc    Get all scores for the logged in user
// @access  Private
router.get('/my-scores', auth, async (req, res) => {
  const student_id = req.user.id;

  try {
    const connection = await pool.getConnection();
    const [scores] = await connection.query(
      `SELECT s.id, s.submitted_text, s.word_count, s.overall_score, 
              s.completed_at, s.diagnostic_data, m.module_name, m.module_type 
       FROM student_scores s 
       JOIN learning_modules m ON s.module_id = m.id 
       WHERE s.student_id = ? 
       ORDER BY s.completed_at DESC`,
      [student_id]
    );

    connection.release();
    res.json(scores);

  } catch (error) {
    console.error('Fetch scores error:', error);
    res.status(500).json({ error: 'Server Error reading from database' });
  }
});

const requireTeacher = require('../middleware/requireTeacher');

// @route   GET api/scores/class-overview
// @desc    Get class overview for teachers (all students and their aggregates)
// @access  Private (Teacher/Admin only)
router.get('/class-overview', requireTeacher, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Query aggregates data per student
    const [overview] = await connection.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email,
        COUNT(s.id) as assignments_completed,
        MAX(s.completed_at) as last_active_date,
        AVG(s.overall_score) as average_band_score,
        GROUP_CONCAT(s.diagnostic_data, '||') as all_diagnostic_data
      FROM users u
      LEFT JOIN student_scores s ON u.id = s.student_id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY last_active_date DESC
    `);
    
    connection.release();
    res.json(overview);
    
  } catch (error) {
    console.error('Class overview error:', error);
    res.status(500).json({ error: 'Server Error fetching class overview' });
  }
});

// @route   GET api/scores/recent
// @desc    Get the most recent submissions across all students
// @access  Private (Teacher/Admin only)
router.get('/recent', requireTeacher, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [recent] = await connection.query(`
      SELECT 
        s.id, 
        s.completed_at, 
        s.overall_score,
        s.module_id,
        m.module_name,
        m.module_type,
        u.first_name as student_first_name, 
        u.last_name as student_last_name
      FROM student_scores s
      JOIN users u ON s.student_id = u.id
      JOIN learning_modules m ON s.module_id = m.id
      ORDER BY s.completed_at DESC
      LIMIT 10
    `);
    
    connection.release();
    res.json(recent);
    
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Server Error fetching recent activity' });
  }
});

// @route   GET api/scores/student/:id
// @desc    Get all detailed submissions for a specific student id
// @access  Private (Teacher/Admin only)
router.get('/student/:id', requireTeacher, async (req, res) => {
  try {
    const student_id = req.params.id;
    const connection = await pool.getConnection();
    
    // First, verify the user is a student to prevent looking up other teachers
    const [userCheck] = await connection.query('SELECT id, first_name, last_name, email, role FROM users WHERE id = ?', [student_id]);
    
    if (userCheck.length === 0 || userCheck[0].role !== 'student') {
      connection.release();
      return res.status(404).json({ error: 'Student not found.' });
    }

    const studentData = userCheck[0];

    const [scores] = await connection.query(`
      SELECT 
        s.id, 
        s.submitted_text, 
        s.word_count, 
        s.overall_score, 
        s.ai_feedback, 
        s.diagnostic_data,
        s.completed_at,
        m.module_name,
        m.module_type
      FROM student_scores s
      JOIN learning_modules m ON s.module_id = m.id
      WHERE s.student_id = ?
      ORDER BY s.completed_at DESC
    `, [student_id]);

    connection.release();

    res.json({
      student: {
        id: studentData.id,
        first_name: studentData.first_name,
        last_name: studentData.last_name,
        email: studentData.email
      },
      submissions: scores.map(score => ({
        ...score,
        // Ensure ai_feedback is parsed correctly if it's stored as a stringified JSON
        ai_feedback: typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback,
        diagnostic_data: typeof score.diagnostic_data === 'string' ? JSON.parse(score.diagnostic_data) : score.diagnostic_data
      }))
    });

  } catch (error) {
    console.error('Fetch student scores error:', error);
    res.status(500).json({ error: 'Server Error fetching student scores' });
  }
});

module.exports = router;
