const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireTeacher = require('../middleware/requireTeacher');
const { pool } = require('../db');

// @route   POST api/assignments
// @desc    Create a new assignment(s) for a specific student, entire class, or all students
// @access  Private (Teacher/Admin only)
router.post('/', requireTeacher, async (req, res) => {
  const { module_id, student_id, class_id, assignment_type, instructions, due_date } = req.body;
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

    if (student_id && student_id !== 'all') {
      // Assign to a specific student
      const [result] = await connection.query(
        `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, instructions, due_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [teacher_id, student_id, module_id, aType, instructions || null, due_date || null]
      );
      
      connection.release();
      return res.status(201).json({ success: true, message: 'Assignment created.', id: result.insertId });
    } else if (class_id) {
      // Assign to an entire class
      const [students] = await connection.query(`SELECT id FROM users WHERE role = 'student' AND class_id = ?`, [class_id]);
      
      if (students.length === 0) {
        connection.release();
        return res.status(400).json({ error: 'No students found in that class.' });
      }

      let count = 0;
      for (const student of students) {
        await connection.query(
          `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, instructions, due_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [teacher_id, student.id, module_id, aType, instructions || null, due_date || null]
        );
        count++;
      }
      
      connection.release();
      return res.status(201).json({ success: true, message: `Assignment created for ${count} students in class.` });
    } else {
      // Assign to all students
      const [students] = await connection.query(`SELECT id FROM users WHERE role = 'student'`);
      
      if (students.length === 0) {
        connection.release();
        return res.status(400).json({ error: 'No students found to assign the task.' });
      }

      let count = 0;
      for (const student of students) {
        await connection.query(
          `INSERT INTO assigned_tasks (teacher_id, student_id, module_id, assignment_type, instructions, due_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [teacher_id, student.id, module_id, aType, instructions || null, due_date || null]
        );
        count++;
      }
      
      connection.release();
      return res.status(201).json({ success: true, message: `Assignment created for ${count} students.` });
    }
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Server Error saving assignment' });
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
      `SELECT a.id, a.assignment_type, a.instructions, a.due_date, a.status, a.created_at,
              m.id as module_id, m.module_name, m.module_type,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name
       FROM assigned_tasks a
       JOIN learning_modules m ON a.module_id = m.id
       JOIN users u ON a.teacher_id = u.id
       WHERE a.student_id = ?
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
  const teacher_id = req.user.id;

  try {
    const connection = await pool.getConnection();
    const [tasks] = await connection.query(
      `SELECT a.id, a.assignment_type, a.instructions, a.due_date, a.status, a.created_at,
              m.module_name, m.module_type,
              u.first_name as student_first_name, u.last_name as student_last_name
       FROM assigned_tasks a
       JOIN learning_modules m ON a.module_id = m.id
       JOIN users u ON a.student_id = u.id
       WHERE a.teacher_id = ?
       ORDER BY a.created_at DESC`,
      [teacher_id]
    );

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
    const placeholders = assignment_ids.map(() => '?').join(',');
    
    await connection.query(
      `UPDATE assigned_tasks 
       SET due_date = ? 
       WHERE teacher_id = ? AND id IN (${placeholders})`,
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
    const placeholders = assignment_ids.map(() => '?').join(',');
    
    await connection.query(
      `DELETE FROM assigned_tasks 
       WHERE teacher_id = ? AND id IN (${placeholders})`,
      [teacher_id, ...assignment_ids]
    );

    connection.release();
    res.json({ success: true, message: 'Assignments deleted successfully.' });
  } catch (error) {
    console.error('Delete bulk assignments error:', error);
    res.status(500).json({ error: 'Server Error deleting assignments' });
  }
});

module.exports = router;
