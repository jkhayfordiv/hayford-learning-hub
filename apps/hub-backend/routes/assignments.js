const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireTeacher = require('../middleware/requireTeacher');
const { pool } = require('../db');

// @route   POST api/assignments
// @desc    Create a new assignment(s) for a specific student, entire class, or all students
// @access  Private (Teacher/Admin only)
router.post('/', requireTeacher, async (req, res) => {
  const { module_id, student_id, class_id, assignment_type, instructions, due_date, grammar_topic_id, level_range, writing_task_type, speaking_task_part, speaking_parts } = req.body;
  const teacher_id = req.user.id;
  const aType = assignment_type || 'writing';
  let connection;
  
  try {
    connection = await pool.getConnection();

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

    // Ensure listening module exists
    const [listeningModules] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'listening' LIMIT 1");
    if (listeningModules.length === 0) {
      await connection.query(
        "INSERT INTO learning_modules (module_name, module_type, description) VALUES ('IELTS Listening', 'listening', 'Practice IELTS Listening tasks with AI feedback.')"
      );
    }
    const [resolvedListeningModule] = await connection.query("SELECT id FROM learning_modules WHERE module_type = 'listening' LIMIT 1");

    if (aType === 'grammar-practice' && !grammar_topic_id) {
      return res.status(400).json({ error: 'grammar_topic_id is required for grammar-practice assignments.' });
    }

    // FIX: Don't default to module_id=1, use what frontend sends (Task 2 = module_id 2)
    const resolvedModuleId = aType === 'grammar-practice'
      ? resolvedGrammarModule?.[0]?.id
      : aType === 'speaking'
        ? resolvedSpeakingModule?.[0]?.id
        : aType === 'listening'
          ? resolvedListeningModule?.[0]?.id
          : module_id;

    if (student_id && student_id !== 'all') {
      // Assign to a specific student
      const speakingPartsJson = speaking_parts ? JSON.stringify(speaking_parts) : (aType === 'speaking' ? '["1"]' : null);
      const speakingTaskPart = speaking_parts && speaking_parts.length > 0 ? speaking_parts[0] : (speaking_task_part || null);
      const [result] = await connection.query(
        `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, grammar_topic_id, level_range, writing_task_type, speaking_task_part, speaking_parts, instructions, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [teacher_id, student_id, resolvedModuleId, aType, grammar_topic_id || null, level_range || null, writing_task_type || null, speakingTaskPart, speakingPartsJson, instructions || null, due_date || null]
      );
      
      return res.status(201).json({ success: true, message: 'Assignment created.', id: result.insertId });
    } else if (class_id) {
      const classIdNum = parseInt(class_id, 10);
      if (!Number.isInteger(classIdNum)) {
        return res.status(400).json({ error: 'Invalid class_id.' });
      }

      const actor_role = req.user.role;
      const actor_institution_id = req.user.institution_id;

      const [classRows] = await connection.query(
        `SELECT id, teacher_id, institution_id FROM classes WHERE id = $1`,
        [classIdNum]
      );
      if (classRows.length === 0) {
        return res.status(404).json({ error: 'Class not found.' });
      }

      const classInfo = classRows[0];
      if (actor_role === 'teacher' && Number(classInfo.teacher_id) !== Number(teacher_id)) {
        return res.status(403).json({ error: 'You can only assign to your own classes.' });
      }
      if (
        actor_role === 'admin' &&
        actor_institution_id &&
        classInfo.institution_id &&
        Number(classInfo.institution_id) !== Number(actor_institution_id)
      ) {
        return res.status(403).json({ error: 'You can only assign to classes in your institution.' });
      }

      let studentsQuery = `
        SELECT u.id 
        FROM users u
        INNER JOIN class_enrollments ce ON u.id = ce.user_id
        WHERE u.role = 'student' AND ce.class_id = $1
      `;
      let studentsParams = [classIdNum];

      if (actor_role === 'admin' && actor_institution_id) {
        studentsQuery = `
          SELECT u.id 
          FROM users u
          INNER JOIN class_enrollments ce ON u.id = ce.user_id
          WHERE u.role = 'student' AND ce.class_id = $1 AND u.institution_id = $2
        `;
        studentsParams = [classIdNum, actor_institution_id];
      }

      const [students] = await connection.query(studentsQuery, studentsParams);
      if (students.length === 0) {
        return res.status(400).json({ error: 'No students found in that class.' });
      }

      const speakingPartsJson = speaking_parts ? JSON.stringify(speaking_parts) : (aType === 'speaking' ? '["1"]' : null);
      const speakingTaskPart = speaking_parts && speaking_parts.length > 0 ? speaking_parts[0] : (speaking_task_part || null);
      let count = 0;
      for (const student of students) {
        try {
          await connection.query(
            `INSERT INTO assigned_tasks (teacher_id, student_id, class_id, module_id, assignment_type, grammar_topic_id, level_range, writing_task_type, speaking_task_part, speaking_parts, instructions, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              teacher_id,
              student.id,
              classIdNum,
              resolvedModuleId,
              aType,
              grammar_topic_id || null,
              level_range || null,
              writing_task_type || null,
              speakingTaskPart,
              speakingPartsJson,
              instructions || null,
              due_date || null
            ]
          );
          count++;
        } catch (dupError) {
          console.error('Error inserting assignment for student:', student.id, dupError.message);
        }
      }

      return res.status(201).json({ success: true, message: `Assignment created for ${count} students in class.` });
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
          INNER JOIN class_enrollments ce ON u.id = ce.user_id
          INNER JOIN classes c ON ce.class_id = c.id
          WHERE u.role = 'student' AND c.teacher_id = $1
        `;
        studentsParams = [teacher_id];
      }
      
      const [students] = await connection.query(studentsQuery, studentsParams);
      
      if (students.length === 0) {
        return res.status(400).json({ error: 'No students found to assign the task.' });
      }

      const speakingPartsJson = speaking_parts ? JSON.stringify(speaking_parts) : (aType === 'speaking' ? '["1"]' : null);
      const speakingTaskPart = speaking_parts && speaking_parts.length > 0 ? speaking_parts[0] : (speaking_task_part || null);
      let count = 0;
      for (const student of students) {
        try {
          await connection.query(
            `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, grammar_topic_id, level_range, writing_task_type, speaking_task_part, speaking_parts, instructions, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [teacher_id, student.id, resolvedModuleId, aType, grammar_topic_id || null, level_range || null, writing_task_type || null, speakingTaskPart, speakingPartsJson, instructions || null, due_date || null]
          );
          count++;
        } catch (dupError) {
          console.warn('Duplicate assignment skipped for student', student.id, dupError.message);
        }
      }
      
      return res.status(201).json({ success: true, message: `Assignment created for ${count} students.` });
    }
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Server Error saving assignment', details: error.message });
  } finally {
    if (connection) connection.release();
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
      `SELECT a.id, a.assignment_type, a.grammar_topic_id, a.level_range, a.writing_task_type, a.speaking_task_part, a.speaking_parts, a.instructions, a.due_date, a.status, a.created_at,
              a.teacher_comment, a.teacher_comment_read, a.feedback_date,
              m.id as module_id, m.module_name, m.module_type,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name,
              g.first_name as grader_first_name, g.last_name as grader_last_name,
              a.speaking_parts
       FROM assigned_tasks a
       JOIN learning_modules m ON a.module_id = m.id
       JOIN users u ON a.teacher_id = u.id
       LEFT JOIN users g ON a.grader_id = g.id
       WHERE a.student_id = $1
       ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END, a.due_date ASC, a.created_at DESC`,
      [student_id]
    );

    // Filter out completed grammar-practice assignments based on grammar_progress
    const filteredTasks = [];
    for (const task of tasks) {
      if (task.assignment_type === 'grammar-practice' && task.grammar_topic_id && task.level_range) {
        // Check if student has completed the assigned levels for this topic
        const [progressRows] = await connection.query(
          `SELECT passed_levels FROM grammar_progress WHERE user_id = $1 AND error_category = $2`,
          [student_id, task.grammar_topic_id]
        );
        
        if (progressRows.length > 0 && progressRows[0].passed_levels) {
          const passedLevels = progressRows[0].passed_levels;
          const requiredLevels = parseRequiredLevels(task.level_range);
          const allLevelsCompleted = requiredLevels.every(level => passedLevels.includes(level));
          
          if (allLevelsCompleted) {
            // Mark as completed and skip adding to filtered tasks (remove from to-do list)
            await connection.query(
              `UPDATE assigned_tasks SET status = 'completed' WHERE id = $1`,
              [task.id]
            );
            continue; // Don't add to filtered tasks
          }
        }
      }
      
      filteredTasks.push(task);
    }

    connection.release();
    res.json(filteredTasks);
  } catch (error) {
    console.error('Fetch my-tasks error:', error);
    res.status(500).json({ error: 'Server Error fetching assigned tasks' });
  }
});

// Helper function to parse level_range string into array of required levels
function parseRequiredLevels(levelRange) {
  if (!levelRange) return [1, 2, 3, 4]; // Default to all levels
  
  if (levelRange.includes('-')) {
    // e.g., "1-3" means levels 1, 2, 3
    const [start, end] = levelRange.split('-').map(Number);
    const levels = [];
    for (let i = start; i <= end; i++) {
      levels.push(i);
    }
    return levels;
  } else {
    // e.g., "1" means just level 1
    return [Number(levelRange)];
  }
}

// @route   GET api/assignments
// @desc    Get all tasks assigned by the logged-in teacher (regardless of role)
// @access  Private (Teacher/Admin only)
router.get('/', requireTeacher, async (req, res) => {
  const actor = req.user;
  const teacher_id = actor.id;

  try {
    const connection = await pool.getConnection();
    
    // All users (Teacher, Admin, SuperAdmin) see their own assignments only
    const query = `
      SELECT a.id, a.assignment_type, a.grammar_topic_id, a.writing_task_type, a.speaking_task_part, a.speaking_parts, a.instructions, a.due_date, a.status, a.created_at,
             a.teacher_comment, a.teacher_comment_read, a.feedback_date,
             m.module_name, m.module_type,
             u.first_name as student_first_name, u.last_name as student_last_name,
             g.first_name as grader_first_name, g.last_name as grader_last_name
      FROM assigned_tasks a
      JOIN learning_modules m ON a.module_id = m.id
      LEFT JOIN users u ON a.student_id = u.id
      LEFT JOIN users g ON a.grader_id = g.id
      WHERE a.teacher_id = $1
      ORDER BY a.created_at DESC
    `;
    const params = [teacher_id];

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

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Start a transaction to ensure both are updated if linked
    await connection.query('START TRANSACTION');

    // 1. Update the assigned_task
    await connection.query(
      `UPDATE assigned_tasks 
       SET teacher_comment = $1, 
           grader_id = $2, 
           feedback_date = CURRENT_TIMESTAMP,
           teacher_comment_read = FALSE 
       WHERE id = $3`,
      [teacher_comment, teacher_id, assignment_id]
    );

    // 2. Update the corresponding student_score if it exists
    await connection.query(
      `UPDATE student_scores 
       SET teacher_comment = $1, 
           teacher_comment_read = false,
           grader_id = $2,
           feedback_date = CURRENT_TIMESTAMP
       WHERE assignment_id = $3 OR id = $3`,
      [teacher_comment, teacher_id, assignment_id]
    );

    await connection.query('COMMIT');
    res.json({ success: true, message: 'Teacher comment saved successfully.' });
  } catch (error) {
    console.error('Update teacher comment error:', error);
    if (connection) await connection.query('ROLLBACK');
    res.status(500).json({ error: 'Server Error saving teacher comment' });
  } finally {
    if (connection) connection.release();
  }
});

// @route   PATCH api/assignments/:id/mark-read
// @desc    Mark teacher comment as read by student
// @access  Private (Student)
router.patch('/:id/mark-read', auth, async (req, res) => {
  const assignment_id = req.params.id;
  const student_id = req.user.id;

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Start transaction to update both tables
    await connection.query('START TRANSACTION');
    
    // 1. Update teacher_comment_read to TRUE for this student's assignment
    const [result] = await connection.query(
      `UPDATE assigned_tasks 
       SET teacher_comment_read = TRUE 
       WHERE id = $1 AND student_id = $2`,
      [assignment_id, student_id]
    );

    // 2. Also update student_scores table (the score ID might match assignment ID or be linked via assignment_id)
    await connection.query(
      `UPDATE student_scores 
       SET teacher_comment_read = TRUE 
       WHERE (id = $1 OR assignment_id = $1) AND student_id = $2`,
      [assignment_id, student_id]
    );

    await connection.query('COMMIT');

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assignment not found or you do not have permission to access it.' });
    }

    res.json({ success: true, message: 'Feedback marked as read.' });
  } catch (error) {
    console.error('Mark feedback as read error:', error);
    if (connection) await connection.query('ROLLBACK');
    res.status(500).json({ error: 'Server Error marking feedback as read' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
