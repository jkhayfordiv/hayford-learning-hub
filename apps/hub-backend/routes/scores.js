const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   POST api/scores
// @desc    Submit a new score and AI feedback for a student
// @access  Private
router.post('/', auth, async (req, res) => {
  const { submitted_text, word_count, overall_score, ai_feedback, diagnostic_tags, grammar_error_counts, taskId, module_type, writingSessionId } = req.body;
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
    } else if (type === 'speaking') {
      // Check if speaking module exists, else create it
      const [speakingModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'speaking' LIMIT 1");
      if (speakingModules.length === 0) {
        const [insertRes] = await connection.query(
          "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('IELTS Speaking', 'speaking', 'Practise IELTS Speaking Parts 1, 2 and 3.')"
        );
        module_id = insertRes.insertId;
      } else {
        module_id = speakingModules[0].id;
      }
    } else if (type === 'grammar-world') {
      // Check if grammar-world module exists, else create it
      const [gwModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'grammar-world' LIMIT 1");
      if (gwModules.length === 0) {
        const [insertRes] = await connection.query(
          "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('Grammar World', 'grammar-world', 'Grammar mastery node completions.')"
        );
        module_id = insertRes.insertId;
      } else {
        module_id = gwModules[0].id;
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

    // Free-tier B2C writing limit: 1 session per calendar month
    const isFreeB2C = req.user.subscription_tier === 'free' && req.user.allow_b2c_payments === true;
    if (isFreeB2C && type === 'writing') {
      const [existing] = await connection.query(
        `SELECT DISTINCT writing_session_id FROM student_scores
         WHERE student_id = $1
           AND writing_session_id IS NOT NULL
           AND DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', CURRENT_DATE)`,
        [student_id]
      );

      const existingIds = existing.map(r => r.writing_session_id);
      const incomingId = writingSessionId || null;

      // Allow if: no sessions yet this month, OR the incoming session is already recorded (same session)
      const isNewSession = incomingId && !existingIds.includes(incomingId);
      const hasExistingSession = existingIds.length > 0;

      if (hasExistingSession && isNewSession) {
        connection.release();
        return res.status(403).json({
          error: 'upgrade_required',
          message: 'You have used your 1 free IELTS Writing test for this month. Upgrade to Premium for unlimited access.'
        });
      }
    }

    // If a taskId was provided, mark the assignment as completed (parse to int for DB)
    const taskIdNum = taskId != null ? parseInt(taskId, 10) : null;

    // Insert score
    const sessionIdToStore = (type === 'writing' && writingSessionId) ? writingSessionId : null;
    const [result] = await connection.query(
      `INSERT INTO student_scores 
       (student_id, module_id, submitted_text, word_count, overall_score, ai_feedback, diagnostic_data, assignment_id, writing_session_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [student_id, module_id, submitted_text, word_count, overall_score, JSON.stringify(ai_feedback), JSON.stringify(diagnostic_tags || []), taskIdNum, sessionIdToStore]
    );

    // PHASE 4: Track identified errors in user_weaknesses table
    const validCategories = [
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

    // Collect errors from IELTS writing (single object with identified_errors)
    let collectedErrors = [];
    if (ai_feedback && ai_feedback.identified_errors && Array.isArray(ai_feedback.identified_errors)) {
      collectedErrors = ai_feedback.identified_errors;
    }

    // Collect errors from vocabulary session (array of {word, sentence, feedback:{identified_errors}})
    if (type === 'vocabulary' && Array.isArray(ai_feedback)) {
      for (const item of ai_feedback) {
        if (item?.feedback?.identified_errors && Array.isArray(item.feedback.identified_errors)) {
          collectedErrors = collectedErrors.concat(item.feedback.identified_errors);
        }
      }
    }

    for (const errorCategory of collectedErrors) {
      if (validCategories.includes(errorCategory)) {
        await connection.query(
          `INSERT INTO user_weaknesses (user_id, category, error_count, last_updated)
           VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, category)
           DO UPDATE SET
             error_count = user_weaknesses.error_count + 1,
             last_updated = CURRENT_TIMESTAMP`,
          [student_id, errorCategory]
        );
      }
    }

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

    // Mark assignment as completed if taskId was provided (already parsed above)
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

// @route   GET api/scores/monthly-usage
// @desc    Return how many distinct writing sessions the current user has used this calendar month
// @access  Private
router.get('/monthly-usage', auth, async (req, res) => {
  const student_id = req.user.id;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT COUNT(DISTINCT writing_session_id) AS writing_sessions
       FROM student_scores
       WHERE student_id = $1
         AND writing_session_id IS NOT NULL
         AND DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [student_id]
    );
    connection.release();
    res.json({ writing_sessions_this_month: parseInt(rows[0]?.writing_sessions || 0, 10) });
  } catch (error) {
    console.error('Monthly usage error:', error);
    res.status(500).json({ error: 'Server Error fetching usage' });
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
              s.completed_at, s.diagnostic_data, s.teacher_comment, s.teacher_comment_read, s.feedback_date,
              m.module_name, m.module_type,
              g.first_name as grader_first_name, g.last_name as grader_last_name
       FROM student_scores s 
       JOIN learning_modules m ON s.module_id = m.id 
       LEFT JOIN users g ON s.grader_id = g.id
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
          u.id, u.first_name, u.last_name, u.email, 
          COALESCE(
            (SELECT ce.class_id FROM class_enrollments ce WHERE ce.user_id = u.id ORDER BY ce.joined_at DESC LIMIT 1),
            NULL
          ) as class_id,
          u.institution_id,
          COUNT(s.id) as assignments_completed,
          MAX(s.completed_at) as last_active_date,
          AVG(s.overall_score) as average_band_score,
          STRING_AGG(CAST(s.diagnostic_data AS TEXT), '||') as all_diagnostic_data
        FROM users u
        LEFT JOIN student_scores s ON u.id = s.student_id
        WHERE u.role = 'student'
        GROUP BY u.id, u.institution_id
        ORDER BY last_active_date DESC`;
      params = [];
    } else if (actor_role === 'admin' && actor_institution_id) {
      // Admin sees all students in their institution
      query = `
        SELECT 
          u.id, u.first_name, u.last_name, u.email,
          COALESCE(
            (SELECT ce.class_id FROM class_enrollments ce WHERE ce.user_id = u.id ORDER BY ce.joined_at DESC LIMIT 1),
            NULL
          ) as class_id,
          u.institution_id,
          COUNT(s.id) as assignments_completed,
          MAX(s.completed_at) as last_active_date,
          AVG(s.overall_score) as average_band_score,
          STRING_AGG(CAST(s.diagnostic_data AS TEXT), '||') as all_diagnostic_data
        FROM users u
        LEFT JOIN student_scores s ON u.id = s.student_id
        WHERE u.role = 'student' AND u.institution_id = $1
        GROUP BY u.id, u.institution_id
        ORDER BY last_active_date DESC`;
      params = [actor_institution_id];
    } else {
      // Teacher sees only students in classes they created
      query = `
        SELECT 
          u.id, u.first_name, u.last_name, u.email,
          COALESCE(
            (SELECT ce.class_id FROM class_enrollments ce WHERE ce.user_id = u.id ORDER BY ce.joined_at DESC LIMIT 1),
            NULL
          ) as class_id,
          u.institution_id,
          COUNT(s.id) as assignments_completed,
          MAX(s.completed_at) as last_active_date,
          AVG(s.overall_score) as average_band_score,
          STRING_AGG(CAST(s.diagnostic_data AS TEXT), '||') as all_diagnostic_data
        FROM users u
        LEFT JOIN student_scores s ON u.id = s.student_id
        JOIN class_enrollments ce ON u.id = ce.user_id
        JOIN classes c ON ce.class_id = c.id
        WHERE u.role = 'student' AND c.teacher_id = $1
        GROUP BY u.id, u.institution_id
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
               s.teacher_comment, s.teacher_comment_read, s.feedback_date,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name,
               g.first_name as grader_first_name, g.last_name as grader_last_name
        FROM student_scores s
        JOIN users u ON s.student_id = u.id
        JOIN learning_modules m ON s.module_id = m.id
        LEFT JOIN users g ON s.grader_id = g.id
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
        s.teacher_comment,
        s.teacher_comment_read,
        s.feedback_date,
        m.module_name,
        m.module_type,
        g.first_name as grader_first_name,
        g.last_name as grader_last_name
      FROM student_scores s
      JOIN learning_modules m ON s.module_id = m.id
      LEFT JOIN users g ON s.grader_id = g.id
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

// @route   GET api/scores/assignment/:taskId
// @desc    Get detailed submission for a specific assignment ID
// @access  Private (Teacher/Admin only)
router.get('/assignment/:taskId', requireTeacher, async (req, res) => {
  const actor_role = req.user.role;
  const actor_id = req.user.id;
  const actor_institution_id = req.user.institution_id;
  const taskId = req.params.taskId;

  try {
    const connection = await pool.getConnection();
    
    // Fetch the score linked to this assignment
    const [scores] = await connection.query(`
      SELECT 
        s.*, 
        u.first_name as student_first_name, u.last_name as student_last_name, u.email as student_email, u.institution_id as student_institution_id, u.class_id as student_class_id,
        m.module_name, m.module_type,
        g.first_name as grader_first_name, g.last_name as grader_last_name
      FROM student_scores s
      JOIN users u ON s.student_id = u.id
      JOIN learning_modules m ON s.module_id = m.id
      LEFT JOIN users g ON s.grader_id = g.id
      WHERE s.assignment_id = $1
    `, [taskId]);

    if (scores.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Submission not found for this assignment.' });
    }

    const submission = scores[0];

    // Tenant isolation check
    if (actor_role === 'admin' && submission.student_institution_id !== actor_institution_id) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: student belongs to different institution' });
    }
    
    if (actor_role === 'teacher') {
      // Verify student is in a class taught by this teacher
      const [classCheck] = await connection.query(
        'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
        [submission.student_class_id, actor_id]
      );
      if (classCheck.length === 0) {
        connection.release();
        return res.status(403).json({ error: 'Access denied: student not in your class' });
      }
    }

    connection.release();

    res.json({
      ...submission,
      ai_feedback: typeof submission.ai_feedback === 'string' ? JSON.parse(submission.ai_feedback) : submission.ai_feedback,
      diagnostic_data: typeof submission.diagnostic_data === 'string' ? JSON.parse(submission.diagnostic_data) : submission.diagnostic_data
    });

  } catch (error) {
    console.error('Fetch assignment submission error:', error);
    res.status(500).json({ error: 'Server Error fetching submission' });
  }
});

// @route   GET api/scores/:id
// @desc    Get a single score/submission by ID
// @access  Private (Teacher/Admin only)
router.get('/:id', requireTeacher, async (req, res) => {
  const scoreId = req.params.id;
  const actor_role = req.user.role;
  const actor_id = req.user.id;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    const [scores] = await connection.query(`
      SELECT 
        s.*, 
        u.first_name as student_first_name, u.last_name as student_last_name, u.email as student_email, u.institution_id as student_institution_id, u.class_id as student_class_id,
        m.module_name, m.module_type,
        g.first_name as grader_first_name, g.last_name as grader_last_name
      FROM student_scores s
      JOIN users u ON s.student_id = u.id
      JOIN learning_modules m ON s.module_id = m.id
      LEFT JOIN users g ON s.grader_id = g.id
      WHERE s.id = $1
    `, [scoreId]);

    if (scores.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const submission = scores[0];

    // Tenant isolation check
    if (actor_role === 'admin' && submission.student_institution_id !== actor_institution_id) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: student belongs to different institution' });
    }
    
    if (actor_role === 'teacher') {
      // Verify student is in a class taught by this teacher
      const [classCheck] = await connection.query(
        'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
        [submission.student_class_id, actor_id]
      );
      if (classCheck.length === 0) {
        connection.release();
        return res.status(403).json({ error: 'Access denied: student not in your class' });
      }
    }

    connection.release();

    res.json({
      ...submission,
      ai_feedback: typeof submission.ai_feedback === 'string' ? JSON.parse(submission.ai_feedback) : submission.ai_feedback,
      diagnostic_data: typeof submission.diagnostic_data === 'string' ? JSON.parse(submission.diagnostic_data) : submission.diagnostic_data
    });

  } catch (error) {
    console.error('Fetch score by ID error:', error);
    res.status(500).json({ error: 'Server Error fetching submission' });
  }
});

// @route   PATCH api/scores/:id/comment
// @desc    Update teacher comment/feedback for a submission
// @access  Private (Teacher/Admin only)
router.patch('/:id/comment', requireTeacher, async (req, res) => {
  const scoreId = req.params.id;
  const { teacher_comment } = req.body;
  const grader_id = req.user.id;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();

    // Verify ownership/permissions before updating
    const [scoreCheck] = await connection.query(`
      SELECT s.id, u.institution_id, u.class_id
      FROM student_scores s
      JOIN users u ON s.student_id = u.id
      WHERE s.id = $1
    `, [scoreId]);

    if (scoreCheck.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const scoreData = scoreCheck[0];

    if (actor_role === 'admin' && scoreData.institution_id !== actor_institution_id) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: student in different institution' });
    }

    if (actor_role === 'teacher') {
      const [classCheck] = await connection.query(
        'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
        [scoreData.class_id, grader_id]
      );
      if (classCheck.length === 0) {
        connection.release();
        return res.status(403).json({ error: 'Access denied: student not in your class' });
      }
    }

    await connection.query(`
      UPDATE student_scores 
      SET teacher_comment = $1, 
          grader_id = $2, 
          feedback_date = CURRENT_TIMESTAMP,
          teacher_comment_read = false
      WHERE id = $3
    `, [teacher_comment, grader_id, scoreId]);

    connection.release();
    res.json({ success: true, message: 'Feedback saved successfully.' });

  } catch (error) {
    console.error('Update teacher comment error:', error);
    res.status(500).json({ error: 'Server Error saving feedback' });
  }
});

module.exports = router;
