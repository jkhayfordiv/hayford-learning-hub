const express = require('express');
const router = express.Router();
const requireTeacher = require('../middleware/requireTeacher');
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   POST api/classes
// @desc    Create a new class
// @access  Private (Teacher only)
router.post('/', requireTeacher, async (req, res) => {
  const { class_name, start_date, end_date } = req.body;
  const teacher_id = req.user.id;
  
  if (!class_name) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    const class_code = require('crypto').randomBytes(3).toString('hex').toUpperCase();

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO classes (class_name, class_code, teacher_id, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [class_name, class_code, teacher_id, start_date || null, end_date || null]
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
      const includeArchived = String(req.query.include_archived || '').toLowerCase() === 'true';

      const [classes] = await connection.query(
        includeArchived
          ? 'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC'
          : "SELECT * FROM classes WHERE teacher_id = $1 AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY created_at DESC",
        [user_id]
      );
      connection.release();
      return res.json(classes);
    } else {
      // Student
      const [userRows] = await connection.query('SELECT class_id FROM users WHERE id = $1', [user_id]);
      if (userRows.length > 0 && userRows[0].class_id) {
        const [classInfo] = await connection.query('SELECT * FROM classes WHERE id = $1', [userRows[0].class_id]);
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
// @desc    Join a class using a code and retroactively assign existing class assignments
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
    const [classes] = await connection.query(
      'SELECT id FROM classes WHERE class_code = $1 AND (end_date IS NULL OR end_date >= CURRENT_DATE)',
      [class_code.toUpperCase()]
    );
    
    if (classes.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Invalid class code' });
    }

    const class_id = classes[0].id;
    await connection.query('UPDATE users SET class_id = $1 WHERE id = $2', [class_id, user_id]);

    // Retroactively assign existing class assignments to the new student
    const [existingAssignments] = await connection.query(
      `SELECT teacher_id, module_id, assignment_type, grammar_topic_id, instructions, due_date
       FROM assigned_tasks
       WHERE student_id IS NULL AND class_id = $1`,
      [class_id]
    );

    if (existingAssignments.length > 0) {
      // Insert assignments for this student, avoiding duplicates
      for (const assignment of existingAssignments) {
        try {
          await connection.query(
            `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, grammar_topic_id, instructions, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (student_id, module_id, assignment_type, grammar_topic_id) DO NOTHING`,
            [
              assignment.teacher_id,
              user_id,
              assignment.module_id,
              assignment.assignment_type,
              assignment.grammar_topic_id,
              assignment.instructions,
              assignment.due_date
            ]
          );
        } catch (dupError) {
          // Ignore duplicate constraint violations; continue with next assignment
          console.warn('Duplicate assignment skipped for student', user_id, dupError.message);
        }
      }
    }
    
    connection.release();
    res.json({ success: true, message: 'Successfully joined class', class_id, retroactiveAssignments: existingAssignments.length });
  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({ error: 'Server error joining class' });
  }
});

// @route   PUT api/classes/:id
// @desc    Update a class's name and dates
// @access  Private (Teacher only)
router.put('/:id', requireTeacher, async (req, res) => {
  const class_id = req.params.id;
  const { class_name, start_date, end_date } = req.body;
  const teacher_id = req.user.id;

  try {
    const connection = await pool.getConnection();
    
    // Verify ownership
    const [existing] = await connection.query('SELECT teacher_id FROM classes WHERE id = $1', [class_id]);
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Class not found' });
    }
    if (existing[0].teacher_id !== teacher_id && req.user.role !== 'admin') {
      connection.release();
      return res.status(403).json({ error: 'Unauthorized to edit this class' });
    }

    await connection.query(
      'UPDATE classes SET class_name = $1, start_date = $2, end_date = $3 WHERE id = $4',
      [class_name, start_date || null, end_date || null, class_id]
    );
    
    connection.release();
    res.json({ success: true, message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Server error updating class' });
  }
});

// @route   DELETE api/classes/:id
// @desc    Delete a class and cascade its relationships
// @access  Private (Teacher only)
router.delete('/:id', requireTeacher, async (req, res) => {
  const class_id = req.params.id;
  const teacher_id = Number(req.user.id);

  try {
    const connection = await pool.getConnection();
    
    // Verify ownership
    const [existing] = await connection.query('SELECT teacher_id FROM classes WHERE id = $1', [class_id]);
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Class not found' });
    }
    if (Number(existing[0].teacher_id) !== teacher_id && req.user.role !== 'admin') {
      connection.release();
      return res.status(403).json({ error: 'Unauthorized to delete this class' });
    }

    // Unassign students explicitly to avoid FK differences across environments.
    await connection.query('UPDATE users SET class_id = NULL WHERE class_id = $1', [class_id]);

    await connection.query('DELETE FROM classes WHERE id = $1', [class_id]);
    
    connection.release();
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Server error deleting class' });
  }
});

// @route   DELETE api/classes/leave
// @desc    Hard remove a student from a class and clean incomplete assignments
// @access  Private (Student only)
router.delete('/leave', auth, async (req, res) => {
  const user_id = req.user.id;

  try {
    const connection = await pool.getConnection();

    // Get current class_id before removal
    const [userRows] = await connection.query('SELECT class_id FROM users WHERE id = $1', [user_id]);
    if (userRows.length === 0 || !userRows[0].class_id) {
      connection.release();
      return res.status(400).json({ error: 'You are not enrolled in any class' });
    }
    const class_id = userRows[0].class_id;

    // Hard delete from class enrollment
    await connection.query('UPDATE users SET class_id = NULL WHERE id = $1', [user_id]);

    // Clean up incomplete assigned_tasks from this class
    // Note: We identify class-originated tasks by joining through assignments that were assigned to the class (student_id IS NULL)
    const [result] = await connection.query(
      `DELETE FROM assigned_tasks
       WHERE student_id = $1
         AND status = 'pending'
         AND (teacher_id, module_id, assignment_type, grammar_topic_id) IN (
           SELECT teacher_id, module_id, assignment_type, grammar_topic_id
           FROM assigned_tasks
           WHERE student_id IS NULL AND class_id = $2
         )`,
      [user_id, class_id]
    );

    connection.release();
    res.json({
      success: true,
      message: 'Successfully left class and cleaned incomplete assignments',
      cleanedAssignments: result.rowCount
    });
  } catch (error) {
    console.error('Leave class error:', error);
    res.status(500).json({ error: 'Server error leaving class' });
  }
});

module.exports = router;
