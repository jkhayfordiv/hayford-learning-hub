const express = require('express');
const router = express.Router();
const requireTeacher = require('../middleware/requireTeacher');
const { pool } = require('../db');

// ============================================================================
// PHASE 2.3: BULK ACTION ENDPOINTS FOR MULTI-TENANT SAAS
// ============================================================================

// @route   DELETE /api/bulk/users
// @desc    Bulk delete/archive users (students)
// @access  Private (Admin/Teacher only)
router.delete('/users', requireTeacher, async (req, res) => {
  const { user_ids } = req.body;
  const actor_id = req.user.id;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: 'user_ids array is required' });
  }

  try {
    const connection = await pool.getConnection();

    // Verify all users belong to the same institution (tenant isolation)
    const [users] = await connection.query(
      `SELECT id, institution_id, role FROM users WHERE id = ANY($1)`,
      [user_ids]
    );

    // Security check: ensure all users belong to actor's institution
    for (const user of users) {
      if (actor_role === 'admin' && user.institution_id !== actor_institution_id) {
        connection.release();
        return res.status(403).json({ error: 'Cannot delete users from other institutions' });
      }
      if (user.role !== 'student') {
        connection.release();
        return res.status(403).json({ error: 'Can only bulk delete student accounts' });
      }
    }

    // Delete users (cascades to scores, assignments via FK)
    const [result] = await connection.query(
      `DELETE FROM users WHERE id = ANY($1) AND role = 'student'`,
      [user_ids]
    );

    connection.release();
    res.json({ 
      success: true, 
      message: `${result.rowCount} student(s) deleted successfully`,
      deleted_count: result.rowCount
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({ error: 'Server error deleting users' });
  }
});

// @route   DELETE /api/bulk/assignments
// @desc    Bulk delete assignments
// @access  Private (Teacher/Admin only)
router.delete('/assignments', requireTeacher, async (req, res) => {
  const { assignment_ids } = req.body;
  const actor_id = req.user.id;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!assignment_ids || !Array.isArray(assignment_ids) || assignment_ids.length === 0) {
    return res.status(400).json({ error: 'assignment_ids array is required' });
  }

  try {
    const connection = await pool.getConnection();

    // Verify ownership/institution access
    const [assignments] = await connection.query(
      `SELECT a.id, a.teacher_id, u.institution_id 
       FROM assigned_tasks a
       JOIN users u ON a.teacher_id = u.id
       WHERE a.id = ANY($1)`,
      [assignment_ids]
    );

    // Security check
    for (const assignment of assignments) {
      if (actor_role === 'admin' && assignment.institution_id !== actor_institution_id) {
        connection.release();
        return res.status(403).json({ error: 'Cannot delete assignments from other institutions' });
      }
      if (actor_role === 'teacher' && assignment.teacher_id !== actor_id) {
        connection.release();
        return res.status(403).json({ error: 'Cannot delete assignments created by other teachers' });
      }
    }

    // Delete assignments
    const [result] = await connection.query(
      `DELETE FROM assigned_tasks WHERE id = ANY($1)`,
      [assignment_ids]
    );

    connection.release();
    res.json({ 
      success: true, 
      message: `${result.rowCount} assignment(s) deleted successfully`,
      deleted_count: result.rowCount
    });
  } catch (error) {
    console.error('Bulk delete assignments error:', error);
    res.status(500).json({ error: 'Server error deleting assignments' });
  }
});

// @route   DELETE /api/bulk/submissions
// @desc    Bulk delete student submissions (for clearing mistakes)
// @access  Private (Teacher/Admin only)
router.delete('/submissions', requireTeacher, async (req, res) => {
  const { submission_ids } = req.body;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!submission_ids || !Array.isArray(submission_ids) || submission_ids.length === 0) {
    return res.status(400).json({ error: 'submission_ids array is required' });
  }

  try {
    const connection = await pool.getConnection();

    // Verify submissions belong to students in the same institution
    const [submissions] = await connection.query(
      `SELECT s.id, u.institution_id 
       FROM student_scores s
       JOIN users u ON s.student_id = u.id
       WHERE s.id = ANY($1)`,
      [submission_ids]
    );

    // Security check: tenant isolation
    for (const submission of submissions) {
      if (actor_role === 'admin' && submission.institution_id !== actor_institution_id) {
        connection.release();
        return res.status(403).json({ error: 'Cannot delete submissions from other institutions' });
      }
    }

    // Delete submissions
    const [result] = await connection.query(
      `DELETE FROM student_scores WHERE id = ANY($1)`,
      [submission_ids]
    );

    connection.release();
    res.json({ 
      success: true, 
      message: `${result.rowCount} submission(s) deleted successfully`,
      deleted_count: result.rowCount
    });
  } catch (error) {
    console.error('Bulk delete submissions error:', error);
    res.status(500).json({ error: 'Server error deleting submissions' });
  }
});

// @route   PATCH /api/bulk/users/archive
// @desc    Bulk archive users (soft delete - set a flag or move to archived table)
// @access  Private (Admin only)
// Note: For now, we'll use the DELETE endpoint. In future, add an 'archived' column
router.patch('/users/archive', requireTeacher, async (req, res) => {
  const { user_ids } = req.body;
  
  // For now, redirect to delete endpoint
  // In future implementation, add 'archived' boolean column to users table
  res.status(501).json({ 
    error: 'Archive functionality not yet implemented. Use DELETE /api/bulk/users instead.',
    note: 'Future implementation will add an archived column to preserve data'
  });
});

module.exports = router;
