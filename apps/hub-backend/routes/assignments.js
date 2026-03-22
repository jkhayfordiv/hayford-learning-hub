const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireTeacher = require('../middleware/requireTeacher');
const { pool } = require('../db');

// @route   POST api/assignments
// @desc    Create a new assignment(s) for a specific student, entire class, or all students
// @access  Private (Teacher/Admin only)
router.post('/', requireTeacher, async (req, res) => {
  const { module_id, student_id, class_id, assignment_type, instructions, due_date, grammar_topic_id, writing_task_type, speaking_task_part } = req.body;
  const teacher_id = req.user.id;
  const aType = assignment_type || 'writing';
  
  try {
    const connection = await pool.getConnection();

    // Ensure learning modules exist since DB wipes could empty them
    const [modules] = await connection.query('SELECT id FROM learning_modules WHERE id = 1');
    if (modules.length === 0) {
      await connection.query(
        "INSERT INTO learning_modules (id, module_name, module_type, description) VALUES (1, 'IELTS Task 1 Academic', 'writing', 'Describe visual data in 150+ words.')"
      );
    }
    const [vocabModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'vocabulary' LIMIT 1");
    if (vocabModules.length === 0) {
      await connection.query(
        "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('Vocabulary Builder', 'vocabulary', 'Practice vocabulary in sentences.')"
      );
    }
    const [grammarModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'grammar' LIMIT 1");
    if (grammarModules.length === 0) {
      await connection.query(
        "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('Grammar Lab', 'grammar', 'Targeted grammar drills by topic and level.')"
      );
    }
    const [resolvedGrammarModule] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'grammar' LIMIT 1");

    // Ensure speaking module exists
    const [speakingModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'speaking' LIMIT 1");
    if (speakingModules.length === 0) {
      await connection.query(
        "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('IELTS Speaking', 'speaking', 'Practice IELTS Speaking tasks with AI feedback.')"
      );
    }
    const [resolvedSpeakingModule] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'speaking' LIMIT 1");

    if (aType === 'grammar-practice' && !grammar_topic_id) {
      connection.release();
      return res.status(400).json({ error: 'grammar_topic_id is required for grammar-practice assignments.' });
    }

    // FIX: Don't default to module_id=1, use what frontend sends (Task 2 = module_id 2)
    const resolvedModuleId = aType === 'grammar-practice'
      ? resolvedGrammarModule?.[0]?.id
      : aType === 'speaking'
        ? resolvedSpeakingModule?.[0]?.id
        : module_id;

    if (student_id && student_id !== 'all') {
      // Assign to a specific student
      const [result] = await connection.query(
        `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, grammar_topic_id, writing_task_type, speaking_task_part, instructions, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [teacher_id, student_id, resolvedModuleId, aType, grammar_topic_id || null, writing_task_type || null, speaking_task_part || null, instructions || null, due_date || null]
      );
      
      connection.release();
      return res.status(201).json({ success: true, message: 'Assignment created.', id: result.insertId });
    } else if (class_id) {
      // Assign to an entire class: create template assignment with class_id
      const [result] = await connection.query(
        `INSERT INTO assigned_tasks (teacher_id, class_id, module_id, assignment_type, grammar_topic_id, writing_task_type, speaking_task_part, instructions, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [teacher_id, class_id, resolvedModuleId, aType, grammar_topic_id || null, writing_task_type || null, speaking_task_part || null, instructions || null, due_date || null]
      );
      
      // Query class_enrollments table for all enrolled students
      const [enrollments] = await connection.query(
        `SELECT user_id FROM class_enrollments WHERE class_id = $1`,
        [class_id]
      );
      
      let count = 0;
      for (const enrollment of enrollments) {
        try {
          await connection.query(
            `INSERT INTO assigned_tasks (teacher_id, student_id, class_id, module_id, assignment_type, grammar_topic_id, writing_task_type, speaking_task_part, instructions, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (student_id, module_id, assignment_type, grammar_topic_id) DO NOTHING`,
            [
              teacher_id,
              enrollment.user_id,
              class_id,
              resolvedModuleId,
              aType,
              grammar_topic_id || null,
              writing_task_type || null,
              speaking_task_part || null,
              instructions || null,
              due_date || null
            ]
          );
          count++;
        } catch (dupError) {
          console.error('Error inserting assignment for student:', enrollment.user_id);
          console.error('Error details:', dupError.message);
          console.error('Values:', { teacher_id, student_id: enrollment.user_id, class_id, module_id: resolvedModuleId, assignment_type: aType, grammar_topic_id, writing_task_type, speaking_task_part, instructions, due_date });
        }
      }
      
      connection.release();
      return res.status(201).json({ success: true, message: `Assignment created for ${count} existing students in class (template stored for late joiners).`, id: result.insertId });
    } else {
      // FIX #3: Assign to "all students" with multi-tenancy privacy walls
      const actor_role = req.user.role;
      const actor_institution_id = req.user.institution_id;
      
      let studentsQuery, studentsParams;
      
      if (actor_role === 'super_admin') {
        // SuperAdmin: truly all students across all institutions
        studentsQuery = `SELECT id FROM users WHERE role = 'student'`;
        studentsParams = [];
      } else if (actor_role === 'admin' && actor_institution_id) {
        // Admin: only students within their institution
        studentsQuery = `SELECT id FROM users WHERE role = 'student' AND institution_id = $1`;
        studentsParams = [actor_institution_id];
      } else {
        // Teacher: only students in classes they created
        studentsQuery = `
          SELECT DISTINCT u.id 
          FROM users u
          INNER JOIN classes c ON u.class_id = c.id
          WHERE u.role = 'student' AND c.teacher_id = $1
        `;
        studentsParams = [teacher_id];
      }
      
      const [students] = await connection.query(studentsQuery, studentsParams);
      
      if (students.length === 0) {
        connection.release();
        return res.status(400).json({ error: 'No students found to assign the task.' });
      }

      let count = 0;
      for (const student of students) {
        try {
          await connection.query(
            `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, grammar_topic_id, writing_task_type, speaking_task_part, instructions, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (student_id, module_id, assignment_type, grammar_topic_id) DO NOTHING`,
            [teacher_id, student.id, resolvedModuleId, aType, grammar_topic_id || null, writing_task_type || null, speaking_task_part || null, instructions || null, due_date || null]
          );
          count++;
        } catch (dupError) {
          console.warn('Duplicate assignment skipped for student', student.id, dupError.message);
        }
      }
      
      connection.release();
      return res.status(201).json({ success: true, message: `Assignment created for ${count} students.` });
    }
  } catch (error) {
    console.error('Create assignment error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({ error: 'Server Error saving assignment', details: error.message });
  }
});

// @route   GET api/assignments/my-tasks
// @desc    Get pending and completed tasks assigned to the logged-in student
// @access  Private (Student)
router.get('/my-tasks', auth, async (req, res) => {
  const student_id = req.user.id;

  try {
    const connection = await pool.getConnection();
    const [tasks] = await connection.query(
      `SELECT a.id, a.assignment_type, a.grammar_topic_id, a.writing_task_type, a.speaking_task_part, a.instructions, a.due_date, a.status, a.created_at,
              m.id as module_id, m.module_name, m.module_type,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name
       FROM assigned_tasks a
       JOIN learning_modules m ON a.module_id = m.id
       JOIN users u ON a.teacher_id = u.id
       WHERE a.student_id = $1
       ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END, a.due_date ASC, a.created_at DESC`,
      [student_id]
    );

    connection.release();
    res.json(tasks);
  } catch (error) {
    console.error('Fetch my-tasks error:', error);
    res.status(500).json({ error: 'Server Error fetching assigned tasks' });
  }
});

// @route   GET api/assignments
// @desc    Get all tasks assigned by the logged-in teacher
// @access  Private (Teacher/Admin only)
router.get('/', requireTeacher, async (req, res) => {
  const actor = req.user;
  const teacher_id = actor.id;
  const role = actor.role;
  const institution_id = actor.institution_id;

  try {
    const connection = await pool.getConnection();
    
    let query, params;
    
    if (role === 'super_admin') {
      // SuperAdmin: see all assignments
      query = `
        SELECT a.id, a.assignment_type, a.grammar_topic_id, a.writing_task_type, a.speaking_task_part, a.instructions, a.due_date, a.status, a.created_at,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name
        FROM assigned_tasks a
        JOIN learning_modules m ON a.module_id = m.id
        LEFT JOIN users u ON a.student_id = u.id
        ORDER BY a.created_at DESC
      `;
      params = [];
    } else if (role === 'admin' && institution_id) {
      // Admin: see all assignments in their institution
      query = `
        SELECT a.id, a.assignment_type, a.grammar_topic_id, a.writing_task_type, a.speaking_task_part, a.instructions, a.due_date, a.status, a.created_at,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name
        FROM assigned_tasks a
        JOIN learning_modules m ON a.module_id = m.id
        JOIN users u ON a.student_id = u.id
        WHERE u.institution_id = $1
        ORDER BY a.created_at DESC
      `;
      params = [institution_id];
    } else {
      // Teacher: see own assignments only
      query = `
        SELECT a.id, a.assignment_type, a.grammar_topic_id, a.writing_task_type, a.speaking_task_part, a.instructions, a.due_date, a.status, a.created_at,
               m.module_name, m.module_type,
               u.first_name as student_first_name, u.last_name as student_last_name
        FROM assigned_tasks a
        JOIN learning_modules m ON a.module_id = m.id
        JOIN users u ON a.student_id = u.id
        WHERE a.teacher_id = $1
        ORDER BY a.created_at DESC
      `;
      params = [teacher_id];
    }

    const [tasks] = await connection.query(query, params);
    connection.release();
    res.json(tasks);
  } catch (error) {
    console.error('Fetch assignments error:', error);
    res.status(500).json({ error: 'Server Error fetching assignments' });
  }
});

// @route   PUT api/assignments/bulk
// @desc    Update due dates for multiple assignments
// @access  Private (Teacher/Admin only)
router.put('/bulk', requireTeacher, async (req, res) => {
  const { assignment_ids, due_date } = req.body;
  const teacher_id = req.user.id;

  if (!assignment_ids || !Array.isArray(assignment_ids) || assignment_ids.length === 0) {
    return res.status(400).json({ error: 'No assignment IDs provided.' });
  }

  try {
    const connection = await pool.getConnection();
    const idPlaceholders = assignment_ids.map((_, idx) => `$${idx + 3}`).join(',');
    
    await connection.query(
      `UPDATE assigned_tasks 
       SET due_date = $1 
       WHERE teacher_id = $2 AND id IN (${idPlaceholders})`,
      [due_date || null, teacher_id, ...assignment_ids]
    );

    connection.release();
    res.json({ success: true, message: 'Assignments updated successfully.' });
  } catch (error) {
    console.error('Update bulk assignments error:', error);
    res.status(500).json({ error: 'Server Error updating assignments' });
  }
});

// @route   DELETE api/assignments/bulk
// @desc    Delete multiple assignments
// @access  Private (Teacher/Admin only)
router.delete('/bulk', requireTeacher, async (req, res) => {
  const { assignment_ids } = req.body;
  const teacher_id = req.user.id;

  if (!assignment_ids || !Array.isArray(assignment_ids) || assignment_ids.length === 0) {
    return res.status(400).json({ error: 'No assignment IDs provided.' });
  }

  try {
    const connection = await pool.getConnection();
    const idPlaceholders = assignment_ids.map((_, idx) => `$${idx + 2}`).join(',');
    
    await connection.query(
      `DELETE FROM assigned_tasks 
       WHERE teacher_id = $1 AND id IN (${idPlaceholders})`,
      [teacher_id, ...assignment_ids]
    );

    connection.release();
    res.json({ success: true, message: 'Assignments deleted successfully.' });
  } catch (error) {
    console.error('Delete bulk assignments error:', error);
    res.status(500).json({ error: 'Server Error deleting assignments' });
  }
});

// @route   PATCH api/assignments/:id/comment
// @desc    Add or update teacher comment on a specific assignment
// @access  Private (Teacher/Admin only)
router.patch('/:id/comment', requireTeacher, async (req, res) => {
  const assignment_id = req.params.id;
  const { teacher_comment } = req.body;
  const teacher_id = req.user.id;

  if (!teacher_comment) {
    return res.status(400).json({ error: 'teacher_comment is required.' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Update the assignment with the teacher's comment and set teacher_comment_read to FALSE
    const [result] = await connection.query(
      `UPDATE assigned_tasks 
       SET teacher_comment = $1, teacher_comment_read = FALSE 
       WHERE id = $2 AND teacher_id = $3`,
      [teacher_comment, assignment_id, teacher_id]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assignment not found or you do not have permission to comment on it.' });
    }

    res.json({ success: true, message: 'Teacher comment saved successfully.' });
  } catch (error) {
    console.error('Update teacher comment error:', error);
    res.status(500).json({ error: 'Server Error saving teacher comment' });
  }
});

// @route   PATCH api/assignments/:id/mark-read
// @desc    Mark teacher comment as read by student
// @access  Private (Student)
router.patch('/:id/mark-read', auth, async (req, res) => {
  const assignment_id = req.params.id;
  const student_id = req.user.id;

  try {
    const connection = await pool.getConnection();
    
    // Update teacher_comment_read to TRUE for this student's assignment
    const [result] = await connection.query(
      `UPDATE assigned_tasks 
       SET teacher_comment_read = TRUE 
       WHERE id = $1 AND student_id = $2`,
      [assignment_id, student_id]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assignment not found or you do not have permission to access it.' });
    }

    res.json({ success: true, message: 'Feedback marked as read.' });
  } catch (error) {
    console.error('Mark feedback as read error:', error);
    res.status(500).json({ error: 'Server Error marking feedback as read' });
  }
});

module.exports = router;
