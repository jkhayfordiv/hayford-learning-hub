const express = require('express');
const router = express.Router();
const requireTeacher = require('../middleware/requireTeacher');
const auth = require('../middleware/auth');
const { pool } = require('../db');

// @route   GET api/users/:id/weaknesses
// @desc    Get top weaknesses for a user (for dashboard display)
// @access  Private
router.get('/:id/weaknesses', auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    // Security: Users can only view their own weaknesses (unless admin/teacher)
    if (req.user.role === 'student' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await pool.getConnection();
    
    const [weaknesses] = await connection.query(
      `SELECT category, error_count, last_updated
       FROM user_weaknesses
       WHERE user_id = $1
       ORDER BY error_count DESC
       LIMIT 5`,
      [userId]
    );
    
    connection.release();
    
    res.json(weaknesses);
  } catch (error) {
    console.error('Get user weaknesses error:', error);
    res.status(500).json({ error: 'Failed to fetch weaknesses' });
  }
});

// @route   GET api/users/me
// @desc    Get current user's profile data
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [users] = await connection.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.institution_id,
              u.subscription_tier AS user_tier, u.stripe_customer_id,
              u.stripe_subscription_id, u.current_period_end, u.avatar_url,
              i.subdomain, i.timezone, i.has_grammar_world, i.has_ielts_speaking,
              i.subscription_tier AS inst_tier, i.subscription_status,
              i.allow_b2c_payments,
              i.primary_color, i.secondary_color, i.logo_url, i.favicon_url, i.welcome_text,
              COALESCE(i.show_writing_on_dashboard, true) AS show_writing_on_dashboard,
              COALESCE(i.show_speaking_on_dashboard, true) AS show_speaking_on_dashboard,
              COALESCE(i.show_grammar_world_on_dashboard, true) AS show_grammar_world_on_dashboard,
              COALESCE(i.show_vocab_on_dashboard, true) AS show_vocab_on_dashboard,
              COALESCE(i.show_writing_lab_on_dashboard, true) AS show_writing_lab_on_dashboard
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    
    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Fetch enrolled classes for the user
    const [enrollmentRows] = await connection.query(
      `SELECT c.id, c.class_name, c.class_code, ce.joined_at
       FROM class_enrollments ce
       JOIN classes c ON ce.class_id = c.id
       WHERE ce.user_id = $1
       ORDER BY ce.joined_at DESC`,
      [user.id]
    );
    
    connection.release();
    
    res.json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      institution_id: user.institution_id,
      subscription_tier: user.user_tier || user.inst_tier || 'free',
      subscription_status: user.subscription_status || 'active',
      allow_b2c_payments: user.allow_b2c_payments || false,
      stripe_customer_id: user.stripe_customer_id || null,
      stripe_subscription_id: user.stripe_subscription_id || null,
      current_period_end: user.current_period_end || null,
      avatar_url: user.avatar_url || null,
      subdomain: user.subdomain,
      timezone: user.timezone || 'Asia/Tokyo',
      has_grammar_world: user.has_grammar_world !== false,
      has_ielts_speaking: user.has_ielts_speaking !== false,
      show_writing_on_dashboard: user.show_writing_on_dashboard !== false,
      show_speaking_on_dashboard: user.show_speaking_on_dashboard !== false,
      show_grammar_world_on_dashboard: user.show_grammar_world_on_dashboard !== false,
      show_vocab_on_dashboard: user.show_vocab_on_dashboard !== false,
      show_writing_lab_on_dashboard: user.show_writing_lab_on_dashboard !== false,
      classes: enrollmentRows,
      class_id: enrollmentRows.length > 0 ? enrollmentRows[0].id : null,
      class_name: enrollmentRows.length > 0 ? enrollmentRows[0].class_name : null
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Server error fetching user profile' });
  }
});

// @route   POST api/users/enroll-class
// @desc    Enroll a student in a class (supports multiple enrollments)
// @access  Private (Teacher/Admin only)
router.post('/enroll-class', requireTeacher, async (req, res) => {
  const { email, class_id } = req.body;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Student email is required.' });
  }

  if (!class_id) {
    return res.status(400).json({ error: 'Class ID is required.' });
  }

  try {
    const connection = await pool.getConnection();

    const [users] = await connection.query(
      'SELECT id, first_name, last_name, role FROM users WHERE LOWER(TRIM(email)) = LOWER($1)',
      [email.trim()]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'No user found with that email address.' });
    }

    // TENANT ISOLATION: Verify class exists and check institution access
    let classQuery, classParams;
    if (actor_role === 'super_admin') {
      classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1';
      classParams = [class_id];
    } else {
      // Admin/Teacher can only enroll in classes within their institution
      classQuery = 'SELECT id, institution_id FROM classes WHERE id = $1 AND institution_id = $2';
      classParams = [class_id, actor_institution_id];
    }
    
    const [classExists] = await connection.query(classQuery, classParams);
    
    if (classExists.length === 0) {
      connection.release();
      return res.status(403).json({ error: 'Class not found or access denied' });
    }

    // Insert enrollment (ON CONFLICT DO NOTHING prevents duplicates)
    await connection.query(
      'INSERT INTO class_enrollments (user_id, class_id) VALUES ($1, $2) ON CONFLICT (user_id, class_id) DO NOTHING',
      [users[0].id, class_id]
    );

    // Update user's institution_id if not set
    await connection.query(
      'UPDATE users SET institution_id = $1 WHERE id = $2 AND institution_id IS NULL',
      [classExists[0].institution_id, users[0].id]
    );

    connection.release();
    res.json({
      success: true,
      message: `${users[0].first_name} ${users[0].last_name} has been enrolled in the class.`,
      user_id: users[0].id,
      user_role: users[0].role,
      class_id: class_id
    });
  } catch (error) {
    console.error('Enroll class error:', error);
    res.status(500).json({ error: 'Server error enrolling student in class.' });
  }
});

// @route   DELETE api/users/unenroll-class
// @desc    Remove a student from a specific class enrollment
// @access  Private (Teacher/Admin only)
router.delete('/unenroll-class', requireTeacher, async (req, res) => {
  const { user_id, class_id } = req.body;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!user_id || !class_id) {
    return res.status(400).json({ error: 'User ID and Class ID are required.' });
  }

  try {
    const connection = await pool.getConnection();

    // TENANT ISOLATION: Verify class belongs to admin's institution
    if (actor_role !== 'super_admin') {
      const [classCheck] = await connection.query(
        'SELECT id FROM classes WHERE id = $1 AND institution_id = $2',
        [class_id, actor_institution_id]
      );
      
      if (classCheck.length === 0) {
        connection.release();
        return res.status(403).json({ error: 'Access denied: Class belongs to a different institution' });
      }
    }

    const [result] = await connection.query(
      'DELETE FROM class_enrollments WHERE user_id = $1 AND class_id = $2',
      [user_id, class_id]
    );

    const deleted = result?.affectedRows ?? result?.rowCount ?? 0;
    connection.release();

    if (deleted === 0) {
      return res.status(404).json({ error: 'Enrollment not found.' });
    }

    res.json({
      success: true,
      message: 'Student has been unenrolled from the class.',
      user_id: user_id,
      class_id: class_id
    });
  } catch (error) {
    console.error('Unenroll class error:', error);
    res.status(500).json({ error: 'Server error unenrolling student from class.' });
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

// @route   DELETE api/users/:id/classes
// @desc    Remove a student from ALL their class enrollments
// @access  Private (SuperAdmin, Teacher, or Student)
router.delete('/:id/classes', auth, async (req, res) => {
  const studentId = Number(req.params.id);
  const actingUserId = req.user.id;
  const actingRole = req.user.role;

  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: 'Invalid student id.' });
  }

  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, first_name, last_name, role FROM users WHERE id = $1',
      [studentId]
    );

    if (users.length === 0 || users[0].role !== 'student') {
      connection.release();
      return res.status(404).json({ error: 'Student not found.' });
    }

    const student = users[0];
    
    // Check if student has any enrollments
    const [enrollments] = await connection.query(
      'SELECT class_id FROM class_enrollments WHERE user_id = $1',
      [studentId]
    );

    if (enrollments.length === 0) {
      connection.release();
      return res.json({ success: true, message: 'Student has no class enrollments.', user_id: studentId });
    }

    // Authorization: SuperAdmin, the Student themselves, or a Teacher of any of the student's classes
    const isSelf = actingUserId === studentId;
    
    if (actingRole !== 'super_admin' && !isSelf) {
      // Check if acting user is a teacher of any of the student's classes
      const classIds = enrollments.map(e => e.class_id);
      const [classes] = await connection.query(
        `SELECT id FROM classes WHERE id = ANY($1) AND teacher_id = $2`,
        [classIds, actingUserId]
      );
      
      if (classes.length === 0) {
        connection.release();
        return res.status(403).json({ error: 'Unauthorized to remove this student from classes.' });
      }
    }

    // Remove all enrollments
    const [result] = await connection.query('DELETE FROM class_enrollments WHERE user_id = $1', [studentId]);
    const deletedCount = result?.affectedRows ?? result?.rowCount ?? 0;
    
    connection.release();
    return res.json({
      success: true,
      message: `${student.first_name} ${student.last_name} has been removed from all classes.`,
      user_id: studentId,
      enrollments_removed: deletedCount
    });
  } catch (error) {
    console.error('Remove student from classes error:', error);
    return res.status(500).json({ error: 'Server error removing student from classes.' });
  }
});

// @route   PATCH api/users/me/password
// @desc    Update user's own password
// @access  Private (All authenticated users)
router.patch('/me/password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const bcrypt = require('bcryptjs');
    const connection = await pool.getConnection();

    // Get current user with password hash
    const [users] = await connection.query(
      'SELECT id, password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      connection.release();
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await connection.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    connection.release();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Server error updating password' });
  }
});

// @route   GET api/users/search
// @desc    Search users by name or email (with tenant isolation)
// @access  Private (Teacher/Admin only)
router.get('/search', requireTeacher, async (req, res) => {
  const { q } = req.query;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const connection = await pool.getConnection();
    const searchTerm = `%${q.trim()}%`;

    // TENANT ISOLATION: Filter by institution for admins/teachers
    let query, params;
    if (actor_role === 'super_admin') {
      query = `
        SELECT 
          id, 
          first_name, 
          last_name, 
          email, 
          role,
          institution_id
        FROM users
        WHERE (
          LOWER(first_name) LIKE LOWER($1) OR
          LOWER(last_name) LIKE LOWER($1) OR
          LOWER(email) LIKE LOWER($1)
        )
        ORDER BY last_name, first_name
        LIMIT 20
      `;
      params = [searchTerm];
    } else {
      // Admin/Teacher: only search within their institution
      query = `
        SELECT 
          id, 
          first_name, 
          last_name, 
          email, 
          role,
          institution_id
        FROM users
        WHERE (
          LOWER(first_name) LIKE LOWER($1) OR
          LOWER(last_name) LIKE LOWER($1) OR
          LOWER(email) LIKE LOWER($1)
        )
        AND institution_id = $2
        ORDER BY last_name, first_name
        LIMIT 20
      `;
      params = [searchTerm, actor_institution_id];
    }

    const [users] = await connection.query(query, params);
    connection.release();

    res.json(users);
  } catch (err) {
    console.error('DB Error in GET /api/users/search:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
