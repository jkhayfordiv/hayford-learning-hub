const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   POST api/scores
// @desc    Submit a new score and AI feedback for a student
// @access  Private
router.post('/', auth, async (req, res) => {
  const { submitted_text, word_count, overall_score, ai_feedback, diagnostic_tags, grammar_error_counts, taskId, module_type } = req.body;
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
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [student_id, module_id, submitted_text, word_count, overall_score, JSON.stringify(ai_feedback), JSON.stringify(diagnostic_tags || [])]
    );

    // Increment grammar progress by actual error counts if provided
    if (grammar_error_counts && typeof grammar_error_counts === 'object') {
      const ERROR_CATEGORY_MAP = {
        '01_article_usage': 'Article Usage',
        '02_countability_and_plurals': 'Countability & Plurals',
        '03_pronoun_reference': 'Pronoun Reference',
        '04_prepositional_accuracy': 'Prepositional Accuracy',
        '05_word_forms': 'Word Forms',
        '06_subject_verb_agreement': 'Subject-Verb Agreement',
        '07_tense_consistency': 'Tense Consistency',
        '08_present_perfect_vs_past_simple': 'Present Perfect vs. Past Simple',
        '09_gerunds_vs_infinitives': 'Gerunds vs. Infinitives',
        '10_passive_voice_construction': 'Passive Voice Construction',
        '11_sentence_boundaries': 'Sentence Boundaries (Fragments/Comma Splices)',
        '12_relative_clauses': 'Relative Clauses',
        '13_subordination': 'Subordination',
        '14_word_order': 'Word Order',
        '15_parallel_structure': 'Parallel Structure',
        '16_transitional_devices': 'Transitional Devices',
        '17_collocations': 'Collocations',
        '18_academic_register': 'Academic Register',
        '19_nominalization': 'Nominalization',
        '20_hedging': 'Hedging'
      };

      for (const [categoryKey, count] of Object.entries(grammar_error_counts)) {
        const categoryName = ERROR_CATEGORY_MAP[categoryKey];
        const errorCount = Number(count);
        
        if (categoryName && Number.isInteger(errorCount) && errorCount > 0) {
          await connection.query(
            `INSERT INTO grammar_progress (student_id, error_category, exercises_completed)
             VALUES ($1, $2, $3)
             ON CONFLICT (student_id, error_category)
             DO UPDATE SET
               exercises_completed = grammar_progress.exercises_completed + EXCLUDED.exercises_completed,
               updated_at = CURRENT_TIMESTAMP`,
            [student_id, categoryName, errorCount]
          );
        }
      }
    }

    // If a taskId was provided, mark the assignment as completed (parse to int for DB)
    const taskIdNum = taskId != null ? parseInt(taskId, 10) : null;
    if (taskIdNum && Number.isInteger(taskIdNum)) {
      try {
        const [updateResult] = await connection.query(
          `UPDATE assigned_tasks SET status = 'completed' WHERE id = $1 AND student_id = $2`,
          [taskIdNum, student_id]
        );
        const updated = updateResult?.affectedRows ?? updateResult?.rowCount ?? 0;
        if (updated === 0) {
          console.warn('Score save: no assigned_tasks row updated for taskId=', taskIdNum, 'student_id=', student_id);
        }
      } catch (updateErr) {
        console.error('Score save: failed to mark assignment completed', { taskId: taskIdNum, student_id, err: updateErr.message });
        // Score was already saved; still return success
      }
    } else if (taskId != null) {
      console.warn('Score save: invalid taskId (not an integer)', taskId);
    }

    connection.release();
    res.status(201).json({
      success: true,
      message: 'Score saved successfully!',
      score_id: result.insertId
    });

  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ error: 'Server Error writing to database', details: error.message });
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
       WHERE s.student_id = $1 
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
  const actor_role = req.user.role;
  const actor_id = req.user.id;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    // PHASE 2.2: Tenant isolation based on role
    let query, params;
    
    if (actor_role === 'super_admin') {
      // Super admin sees all students
      query = `
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.class_id, u.institution_id,
          COUNT(s.id) as assignments_completed,
          MAX(s.completed_at) as last_active_date,
          AVG(s.overall_score) as average_band_score,
          STRING_AGG(CAST(s.diagnostic_data AS TEXT), '||') as all_diagnostic_data
        FROM users u
        LEFT JOIN student_scores s ON u.id = s.student_id
        WHERE u.role = 'student'
        GROUP BY u.id, u.class_id, u.institution_id
        ORDER BY last_active_date DESC`;
      params = [];
    } else if (actor_role === 'admin' && actor_institution_id) {
      // Admin sees all students in their institution
      query = `
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.class_id, u.institution_id,
          COUNT(s.id) as assignments_completed,
          MAX(s.completed_at) as last_active_date,
          AVG(s.overall_score) as average_band_score,
          STRING_AGG(CAST(s.diagnostic_data AS TEXT), '||') as all_diagnostic_data
        FROM users u
        LEFT JOIN student_scores s ON u.id = s.student_id
        WHERE u.role = 'student' AND u.institution_id = $1
        GROUP BY u.id, u.class_id, u.institution_id
        ORDER BY last_active_date DESC`;
      params = [actor_institution_id];
    } else {
      // Teacher sees only students in classes they created
      query = `
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.class_id, u.institution_id,
          COUNT(s.id) as assignments_completed,
          MAX(s.completed_at) as last_active_date,
          AVG(s.overall_score) as average_band_score,
          STRING_AGG(CAST(s.diagnostic_data AS TEXT), '||') as all_diagnostic_data
        FROM users u
        LEFT JOIN student_scores s ON u.id = s.student_id
        JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'student' AND c.teacher_id = $1
        GROUP BY u.id, u.class_id, u.institution_id
        ORDER BY last_active_date DESC`;
      params = [actor_id];
    }
    
    const [overview] = await connection.query(query, params);
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
  const actor_role = req.user.role;
  const actor_id = req.user.id;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    // PHASE 2.2: Tenant isolation
    let query, params;
    
    if (actor_role === 'super_admin') {
      query = `
        SELECT s.id, s.completed_at, s.overall_score, s.module_id,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name
        FROM student_scores s
        JOIN users u ON s.student_id = u.id
        JOIN learning_modules m ON s.module_id = m.id
        ORDER BY s.completed_at DESC LIMIT 10`;
      params = [];
    } else if (actor_role === 'admin' && actor_institution_id) {
      query = `
        SELECT s.id, s.completed_at, s.overall_score, s.module_id,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name
        FROM student_scores s
        JOIN users u ON s.student_id = u.id
        JOIN learning_modules m ON s.module_id = m.id
        WHERE u.institution_id = $1
        ORDER BY s.completed_at DESC LIMIT 10`;
      params = [actor_institution_id];
    } else {
      // Teacher sees only their class students
      query = `
        SELECT s.id, s.completed_at, s.overall_score, s.module_id,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name
        FROM student_scores s
        JOIN users u ON s.student_id = u.id
        JOIN learning_modules m ON s.module_id = m.id
        JOIN classes c ON u.class_id = c.id
        WHERE c.teacher_id = $1
        ORDER BY s.completed_at DESC LIMIT 10`;
      params = [actor_id];
    }
    
    const [recent] = await connection.query(query, params);
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
  const actor_role = req.user.role;
  const actor_id = req.user.id;
  const actor_institution_id = req.user.institution_id;

  try {
    const student_id = req.params.id;
    const connection = await pool.getConnection();
    
    // PHASE 2.2: Verify the user is a student AND belongs to actor's scope
    const [userCheck] = await connection.query(
      'SELECT id, first_name, last_name, email, role, institution_id, class_id FROM users WHERE id = $1',
      [student_id]
    );
    
    if (userCheck.length === 0 || userCheck[0].role !== 'student') {
      connection.release();
      return res.status(404).json({ error: 'Student not found.' });
    }

    const studentData = userCheck[0];
    
    // Tenant isolation check
    if (actor_role === 'admin' && studentData.institution_id !== actor_institution_id) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: student belongs to different institution' });
    }
    
    if (actor_role === 'teacher') {
      // Verify student is in a class taught by this teacher
      const [classCheck] = await connection.query(
        'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
        [studentData.class_id, actor_id]
      );
      if (classCheck.length === 0) {
        connection.release();
        return res.status(403).json({ error: 'Access denied: student not in your class' });
      }
    }

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
      WHERE s.student_id = $1
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
