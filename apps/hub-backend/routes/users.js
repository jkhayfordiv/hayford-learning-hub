const express = require('express');
const router = express.Router();
const requireTeacher = require('../middleware/requireTeacher');
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   PATCH api/users/assign-class
// @desc    Assign an existing student to a class (by email)
// @access  Private (Teacher/Admin only)
router.patch('/assign-class', requireTeacher, async (req, res) => {
  const { email, class_id } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Student email is required.' });
  }

  try {
    const connection = await pool.getConnection();

    const [users] = await connection.query(
      'SELECT id, first_name, last_name, class_id FROM users WHERE LOWER(TRIM(email)) = LOWER($1) AND role = $2',
      [email.trim(), 'student']
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'No student found with that email address.' });
    }

    const newClassId = class_id === '' || class_id === null ? null : Number(class_id);
    if (newClassId !== null) {
      const [classExists] = await connection.query(
        'SELECT id FROM classes WHERE id = $1',
        [newClassId]
      );
      if (classExists.length === 0) {
        connection.release();
        return res.status(400).json({ error: 'Invalid class selected.' });
      }
    }

    await connection.query(
      'UPDATE users SET class_id = $1 WHERE id = $2',
      [newClassId, users[0].id]
    );

    connection.release();
    res.json({
      success: true,
      message: newClassId
        ? `${users[0].first_name} ${users[0].last_name} has been assigned to the class.`
        : `${users[0].first_name} ${users[0].last_name} has been removed from their class.`,
      user_id: users[0].id,
      class_id: newClassId
    });
  } catch (error) {
    console.error('Assign class error:', error);
    res.status(500).json({ error: 'Server error updating student class.' });
  }
});

// @route   DELETE api/users/me
// @desc    Delete the currently authenticated student's account
// @access  Private (Student)
router.delete('/me', auth, async (req, res) => {
  const userId = req.user.id;

  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only student accounts can be deleted from this endpoint.' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM users WHERE id = $1 AND role = $2', [userId, 'student']);
    const deleted = result?.affectedRows ?? result?.rowCount ?? 0;
    connection.release();

    if (deleted === 0) {
      return res.status(404).json({ error: 'Student account not found.' });
    }

    return res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Server error deleting account.' });
  }
});

// @route   DELETE api/users/:id/class
// @desc    Remove a student from their class
// @access  Private (Teacher/Admin)
router.delete('/:id/class', requireTeacher, async (req, res) => {
  const studentId = Number(req.params.id);
  const actingUserId = req.user.id;
  const actingRole = req.user.role;

  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: 'Invalid student id.' });
  }

  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, first_name, last_name, role, class_id FROM users WHERE id = $1',
      [studentId]
    );

    if (users.length === 0 || users[0].role !== 'student') {
      connection.release();
      return res.status(404).json({ error: 'Student not found.' });
    }

    const student = users[0];
    if (!student.class_id) {
      connection.release();
      return res.json({ success: true, message: 'Student is already unassigned.', user_id: studentId, class_id: null });
    }

    if (actingRole !== 'admin') {
      const [classes] = await connection.query('SELECT teacher_id FROM classes WHERE id = $1', [student.class_id]);
      if (classes.length === 0 || classes[0].teacher_id !== actingUserId) {
        connection.release();
        return res.status(403).json({ error: 'Unauthorized to remove this student from class.' });
      }
    }

    await connection.query('UPDATE users SET class_id = NULL WHERE id = $1', [studentId]);
    connection.release();
    return res.json({
      success: true,
      message: `${student.first_name} ${student.last_name} has been removed from their class.`,
      user_id: studentId,
      class_id: null
    });
  } catch (error) {
    console.error('Remove student from class error:', error);
    return res.status(500).json({ error: 'Server error removing student from class.' });
  }
});

module.exports = router;
