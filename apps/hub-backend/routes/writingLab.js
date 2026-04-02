const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireTeacher = require('../middleware/requireTeacher');
const { pool } = require('../db');
const { gradeWritingLabDraft, generatePeerReviewHints, AiRequestError } = require('../services/aiService');

const VALID_WEAKNESS_CATEGORIES = [
  'Article Usage', 'Countability & Plurals', 'Pronoun Reference', 'Prepositional Accuracy',
  'Word Forms', 'Subject-Verb Agreement', 'Tense Consistency', 'Present Perfect vs. Past Simple',
  'Gerunds vs. Infinitives', 'Passive Voice Construction', 'Sentence Boundaries (Fragments/Comma Splices)',
  'Relative Clauses', 'Subordination', 'Word Order', 'Parallel Structure', 'Transitional Devices',
  'Collocations', 'Academic Register', 'Nominalization', 'Hedging'
];

async function persistWritingLabWeaknesses(connection, userId, identifiedErrors) {
  if (!userId || !Array.isArray(identifiedErrors) || identifiedErrors.length === 0) return;
  for (const category of identifiedErrors) {
    if (VALID_WEAKNESS_CATEGORIES.includes(category)) {
      await connection.query(
        `INSERT INTO user_weaknesses (user_id, category, error_count, last_updated)
         VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, category)
         DO UPDATE SET error_count = user_weaknesses.error_count + 1, last_updated = CURRENT_TIMESTAMP`,
        [userId, category]
      );
    }
  }
}

// @route   POST /api/writing-lab/sessions
// @desc    Create a new writing lab session (optionally linked to an assignment)
// @access  Private (Student)
router.post('/sessions', auth, async (req, res) => {
  const { assignment_id, configuration } = req.body;
  const student_id = req.user.id;

  if (!configuration || !configuration.level || !configuration.genre || !configuration.support_level) {
    return res.status(400).json({ error: 'configuration.level, configuration.genre, and configuration.support_level are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // If assignment_id provided, verify it belongs to this student
    if (assignment_id) {
      const [tasks] = await connection.query(
        `SELECT id FROM assigned_tasks WHERE id = $1 AND student_id = $2`,
        [assignment_id, student_id]
      );
      if (tasks.length === 0) {
        return res.status(404).json({ error: 'Assignment not found or not assigned to you.' });
      }
    }

    const [rows] = await connection.query(
      `INSERT INTO writing_lab_submissions (student_id, assignment_id, configuration, status)
       VALUES ($1, $2, $3, 'configuring') RETURNING id, status, created_at`,
      [student_id, assignment_id || null, JSON.stringify(configuration)]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Writing Lab] POST /sessions error:', err.message);
    res.status(500).json({ error: 'Failed to create writing lab session.' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   GET /api/writing-lab/sessions/:id
// @desc    Fetch a session for resume (student can only fetch their own)
// @access  Private (Student or Teacher+)
router.get('/sessions/:id', auth, async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM writing_lab_submissions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Session not found.' });

    const session = rows[0];
    const isTeacherPlus = ['teacher', 'admin', 'super_admin'].includes(req.user.role);
    if (!isTeacherPlus && session.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json(session);
  } catch (err) {
    console.error('[Writing Lab] GET /sessions/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch session.' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   PATCH /api/writing-lab/sessions/:id
// @desc    Autosave planning data, draft text, or status transition
// @access  Private (Student — own session only)
router.patch('/sessions/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { planning_data, draft_1_text, draft_2_text, status } = req.body;

  const VALID_STATUSES = ['configuring', 'planning', 'drafting', 'revising', 'submitted', 'graded'];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, student_id, status FROM writing_lab_submissions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Session not found.' });
    if (rows[0].student_id !== req.user.id) return res.status(403).json({ error: 'Access denied.' });

    const updates = [];
    const params = [];
    let idx = 1;

    if (planning_data !== undefined) { updates.push(`planning_data = $${idx++}`); params.push(JSON.stringify(planning_data)); }
    if (draft_1_text !== undefined)  { updates.push(`draft_1_text = $${idx++}`);  params.push(draft_1_text); }
    if (draft_2_text !== undefined)  { updates.push(`draft_2_text = $${idx++}`);  params.push(draft_2_text); }
    if (status !== undefined)        { updates.push(`status = $${idx++}`);        params.push(status); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    await connection.query(
      `UPDATE writing_lab_submissions SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[Writing Lab] PATCH /sessions/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update session.' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   POST /api/writing-lab/sessions/:id/peer-review
// @desc    Call AI peer review on first draft; save hints, advance status to revising
// @access  Private (Student — own session only)
router.post('/sessions/:id/peer-review', auth, async (req, res) => {
  const { id } = req.params;
  const requestId = `peer-review-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, student_id, status, draft_1_text, configuration FROM writing_lab_submissions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Session not found.' });

    const session = rows[0];
    if (session.student_id !== req.user.id) return res.status(403).json({ error: 'Access denied.' });

    const draftText = req.body.draft_1_text || session.draft_1_text;
    if (!draftText || draftText.trim().split(/\s+/).filter(Boolean).length < 10) {
      return res.status(400).json({ error: 'Draft is too short to review. Please write more before requesting feedback.' });
    }

    const config = session.configuration || {};
    const level = config.level || 'paragraph';
    const genre = config.genre || 'Opinion / Argumentative';

    console.log(`[Writing Lab][${requestId}] Generating peer review hints for student ${req.user.id}`);

    const hints = await generatePeerReviewHints({ text: draftText, genre, level });

    // Persist the draft (in case it was updated in the browser) and the hints
    await connection.query(
      `UPDATE writing_lab_submissions
       SET draft_1_text = $1,
           ai_hints = $2,
           status = 'revising',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [draftText, JSON.stringify(hints), id]
    );

    res.json({ hints, session_id: parseInt(id, 10) });

  } catch (err) {
    console.error(`[Writing Lab][${requestId}] Peer review error:`, err.message);
    if (err instanceof AiRequestError) {
      if (err.isTimeout) return res.status(504).json({ error: 'The AI tutor took too long to respond. Please try again.' });
      if (err.statusCode === 429) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    res.status(500).json({ error: 'Failed to generate peer review. Please try again.' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   POST /api/writing-lab/sessions/:id/submit
// @desc    Submit final draft: grade via AI, persist weaknesses, mark assignment done
// @access  Private (Student — own session only)
router.post('/sessions/:id/submit', auth, async (req, res) => {
  const { id } = req.params;
  const requestId = `wlab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM writing_lab_submissions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Session not found.' });

    const session = rows[0];
    if (session.student_id !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (!session.draft_2_text && !req.body.draft_2_text) {
      return res.status(400).json({ error: 'draft_2_text is required for submission.' });
    }

    const finalText = req.body.draft_2_text || session.draft_2_text;
    const config = session.configuration || {};
    const level = config.level || 'paragraph';
    const genre = config.genre || 'Opinion / Argumentative';

    console.log(`[Writing Lab][${requestId}] Grading submission for student ${req.user.id}`);

    const gradeResult = await gradeWritingLabDraft({ text: finalText, level, genre, requestId });

    const finalScore = {
      score: gradeResult.score,
      band_equivalent: gradeResult.band_equivalent,
      feedback: gradeResult.feedback,
    };

    // Update session with results
    await connection.query(
      `UPDATE writing_lab_submissions
       SET draft_2_text = $1,
           final_score = $2,
           grammar_weaknesses_flagged = $3,
           status = 'submitted',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        finalText,
        JSON.stringify(finalScore),
        JSON.stringify(gradeResult.grammar_weaknesses || []),
        id
      ]
    );

    // Persist weaknesses to user_weaknesses table
    if (gradeResult.identified_errors && gradeResult.identified_errors.length > 0) {
      await persistWritingLabWeaknesses(connection, req.user.id, gradeResult.identified_errors);
    }

    // Mark assignment as completed if linked
    if (session.assignment_id) {
      await connection.query(
        `UPDATE assigned_tasks SET status = 'completed' WHERE id = $1 AND student_id = $2`,
        [session.assignment_id, req.user.id]
      );
    }

    // Also save to student_scores for Recent Activity tracking
    const [wlModule] = await connection.query(
      `SELECT id FROM learning_modules WHERE module_type = 'writing_lab' LIMIT 1`
    );
    let moduleId;
    if (wlModule.length === 0) {
      const [ins] = await connection.query(
        `INSERT INTO learning_modules (module_name, module_type, description)
         VALUES ('Writing Lab', 'writing_lab', 'Guided paragraph and essay writing with AI feedback.')
         RETURNING id`
      );
      moduleId = ins[0].id;
    } else {
      moduleId = wlModule[0].id;
    }

    await connection.query(
      `INSERT INTO student_scores (student_id, module_id, submitted_text, word_count, overall_score, ai_feedback, diagnostic_data, assignment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.id,
        moduleId,
        finalText,
        finalText.split(/\s+/).filter(Boolean).length,
        gradeResult.score,
        JSON.stringify(finalScore),
        JSON.stringify(gradeResult.identified_errors || []),
        session.assignment_id || null
      ]
    );

    res.json({
      success: true,
      session_id: parseInt(id, 10),
      final_score: finalScore,
      grammar_weaknesses_flagged: gradeResult.grammar_weaknesses || [],
      identified_errors: gradeResult.identified_errors || [],
    });

  } catch (err) {
    console.error(`[Writing Lab][${requestId}] Submit error:`, err.message);
    if (err instanceof AiRequestError) {
      if (err.isTimeout) return res.status(504).json({ error: 'AI grading timed out. Please try again.' });
      if (err.statusCode === 429) return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    }
    res.status(500).json({ error: 'Failed to submit and grade your draft.' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   GET /api/writing-lab/submissions
// @desc    Get all writing lab submissions for students accessible to the teacher
// @access  Private (Teacher+)
router.get('/submissions', requireTeacher, async (req, res) => {
  const actor = req.user;
  let connection;
  try {
    connection = await pool.getConnection();

    let query, params;

    if (actor.role === 'super_admin') {
      query = `
        SELECT wls.*, u.first_name, u.last_name, u.email
        FROM writing_lab_submissions wls
        JOIN users u ON wls.student_id = u.id
        ORDER BY wls.updated_at DESC`;
      params = [];
    } else if (actor.role === 'admin') {
      query = `
        SELECT wls.*, u.first_name, u.last_name, u.email
        FROM writing_lab_submissions wls
        JOIN users u ON wls.student_id = u.id
        WHERE u.institution_id = $1
        ORDER BY wls.updated_at DESC`;
      params = [actor.institution_id];
    } else {
      // Teacher: students in their classes
      query = `
        SELECT wls.*, u.first_name, u.last_name, u.email
        FROM writing_lab_submissions wls
        JOIN users u ON wls.student_id = u.id
        WHERE u.id IN (
          SELECT DISTINCT ce.user_id
          FROM class_enrollments ce
          JOIN classes c ON ce.class_id = c.id
          WHERE c.teacher_id = $1
        )
        ORDER BY wls.updated_at DESC`;
      params = [actor.id];
    }

    const [rows] = await connection.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[Writing Lab] GET /submissions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   PATCH /api/writing-lab/submissions/:id/feedback
// @desc    Save teacher feedback and mark session as graded
// @access  Private (Teacher+)
router.patch('/submissions/:id/feedback', requireTeacher, async (req, res) => {
  const { id } = req.params;
  const { teacher_feedback } = req.body;

  if (typeof teacher_feedback !== 'string') {
    return res.status(400).json({ error: 'teacher_feedback (string) is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id FROM writing_lab_submissions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found.' });

    await connection.query(
      `UPDATE writing_lab_submissions
       SET teacher_feedback = $1, status = 'graded', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [teacher_feedback, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Writing Lab] PATCH /submissions/:id/feedback error:', err.message);
    res.status(500).json({ error: 'Failed to save teacher feedback.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
