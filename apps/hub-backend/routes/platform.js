const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET is not defined'); process.exit(1); }

// Middleware to verify super_admin or admin
const verifyAdminOrSuperAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.user.role !== 'super_admin' && decoded.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin or Super admin access required' });
    }
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to verify super_admin only
const verifySuperAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET all users (SuperAdmin: all users, Admin: only their institution)
router.get('/users/all', verifyAdminOrSuperAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const actor_role = req.user.role;
    const actor_institution_id = req.user.institution_id;
    
    let query, params;
    
    if (actor_role === 'super_admin') {
      // SuperAdmin sees ALL users across ALL institutions
      query = `
        SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.email, 
          u.role, 
          u.institution_id,
          i.name as institution_name,
          u.created_at,
          COALESCE(
            json_agg(
              json_build_object('class_id', c.id, 'class_name', c.class_name)
              ORDER BY ce.joined_at DESC
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'::json
          ) as classes
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        LEFT JOIN class_enrollments ce ON u.id = ce.user_id
        LEFT JOIN classes c ON ce.class_id = c.id
        GROUP BY u.id, i.name
        ORDER BY u.id ASC
      `;
      params = [];
    } else if (actor_role === 'admin' && actor_institution_id) {
      // Admin sees only users in THEIR institution
      query = `
        SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.email, 
          u.role, 
          u.institution_id,
          i.name as institution_name,
          u.created_at,
          COALESCE(
            json_agg(
              json_build_object('class_id', c.id, 'class_name', c.class_name)
              ORDER BY ce.joined_at DESC
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'::json
          ) as classes
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        LEFT JOIN class_enrollments ce ON u.id = ce.user_id
        LEFT JOIN classes c ON ce.class_id = c.id
        WHERE u.institution_id = $1
        GROUP BY u.id, i.name
        ORDER BY u.id ASC
      `;
      params = [actor_institution_id];
    } else {
      connection.release();
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [users] = await connection.query(query, params);
    
    // Add backwards compatibility fields (class_id and class_name from first enrollment)
    const usersWithCompat = users.map(user => ({
      ...user,
      class_id: user.classes && user.classes.length > 0 ? user.classes[0].class_id : null,
      class_name: user.classes && user.classes.length > 0 ? user.classes[0].class_name : null
    }));
    
    connection.release();
    res.json(usersWithCompat);
  } catch (err) {
    console.error('DB Error in GET /api/users/all:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH update user (role, institution_id) - Admin and SuperAdmin
// Note: Class enrollments are managed via /api/users/enroll-class and /api/users/unenroll-class
router.patch('/users/:id', verifyAdminOrSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, institution_id } = req.body;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    // TENANT ISOLATION: Verify user exists and belongs to admin's institution
    if (actor_role === 'admin') {
      const [userCheck] = await connection.query(
        'SELECT id, institution_id FROM users WHERE id = $1',
        [id]
      );
      
      if (userCheck.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Admin can only update users in their institution
      if (userCheck[0].institution_id !== actor_institution_id) {
        connection.release();
        return res.status(403).json({ error: 'Access denied: User belongs to a different institution' });
      }
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (role) {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    if (institution_id !== undefined) {
      updates.push(`institution_id = $${paramIndex++}`);
      values.push(institution_id || null);
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    
    // TENANT ISOLATION: Add institution_id constraint for admins
    let whereClause = `WHERE id = $${paramIndex}`;
    if (actor_role === 'admin') {
      paramIndex++;
      whereClause += ` AND institution_id = $${paramIndex}`;
      values.push(actor_institution_id);
    }
    
    const query = `UPDATE users SET ${updates.join(', ')} ${whereClause}`;
    
    const [result] = await connection.query(query, values);
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    
    connection.release();
    
    if (updated === 0) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('DB Error in PATCH /api/users/:id:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PATCH reset user password - Admin and SuperAdmin with Tenant Isolation
router.patch('/users/:id/reset-password', verifyAdminOrSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const bcrypt = require('bcryptjs');
    const connection = await pool.getConnection();
    
    // TENANT ISOLATION: Verify user exists and belongs to admin's institution
    const [userCheck] = await connection.query(
      'SELECT id, institution_id, email FROM users WHERE id = $1',
      [id]
    );
    
    if (userCheck.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Admin can only reset passwords for users in their institution
    if (actor_role === 'admin' && userCheck[0].institution_id !== actor_institution_id) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: User belongs to a different institution' });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);
    
    // Update password with tenant isolation
    let updateQuery, updateParams;
    if (actor_role === 'super_admin') {
      updateQuery = 'UPDATE users SET password_hash = $1 WHERE id = $2';
      updateParams = [password_hash, id];
    } else {
      // Admin: add institution_id constraint
      updateQuery = 'UPDATE users SET password_hash = $1 WHERE id = $2 AND institution_id = $3';
      updateParams = [password_hash, id, actor_institution_id];
    }
    
    const [result] = await connection.query(updateQuery, updateParams);
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    
    connection.release();
    
    if (updated === 0) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }
    
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('DB Error in PATCH /api/users/:id/reset-password:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE user permanently - Admin and SuperAdmin
router.delete('/users/:id', verifyAdminOrSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actor_role = req.user.role;
  const actor_institution_id = req.user.institution_id;

  try {
    const connection = await pool.getConnection();
    
    // 1. Get user role and basic info with institution check
    const [userRows] = await connection.query(
      'SELECT role, first_name, last_name, institution_id FROM users WHERE id = $1', 
      [id]
    );
    
    if (userRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userRole = userRows[0].role;
    const userInstitutionId = userRows[0].institution_id;
    
    // TENANT ISOLATION: Admin can only delete users in their institution
    if (actor_role === 'admin' && userInstitutionId !== actor_institution_id) {
      connection.release();
      return res.status(403).json({ error: 'Access denied: User belongs to a different institution' });
    }

    // 2. Special Case: If Teacher, reassign classes to a SuperAdmin
    if (userRole === 'teacher') {
      // Find the first available SuperAdmin (excluding the one being deleted, just in case)
      const [superAdmins] = await connection.query(
        'SELECT id FROM users WHERE role = $1 AND id != $2 LIMIT 1', 
        ['super_admin', id]
      );
      
      const fallbackAdminId = superAdmins.length > 0 ? superAdmins[0].id : null;
      
      if (fallbackAdminId) {
        await connection.query('UPDATE classes SET teacher_id = $1 WHERE teacher_id = $2', [fallbackAdminId, id]);
        console.log(`Reassigned classes from teacher ${id} to SuperAdmin ${fallbackAdminId}`);
      } else {
        // If no other SuperAdmin exists (highly unlikely), set to null to avoid FK errors
        await connection.query('UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1', [id]);
      }
    }

    // 3. Deep Clean Deletion Sequence (Shadow Tables first to respect potential FKs)
    // Order: user_logs -> student_attendance -> student_answers -> grammar_progress -> student_scores -> assigned_tasks -> submissions
    const tablesToClean = [
      { name: 'user_logs', column: 'user_id' },
      { name: 'student_attendance', column: 'student_id' },
      { name: 'student_answers', column: 'student_id' },
      { name: 'grammar_progress', column: 'student_id' },
      { name: 'student_scores', column: 'student_id' },
      { name: 'assigned_tasks', column: 'student_id' },
      { name: 'submissions', column: 'student_id' }
    ];

    for (const table of tablesToClean) {
      try {
        await connection.query(`DELETE FROM ${table.name} WHERE ${table.column} = $1`, [id]);
      } catch (err) {
        // Table might not exist in all environments, log but continue
        console.warn(`Cleanup: Could not delete from ${table.name} (it might not exist).`);
      }
    }
    
    // 4. Finally delete the user
    await connection.query('DELETE FROM users WHERE id = $1', [id]);
    
    connection.release();
    res.json({ 
      message: 'User deleted and records cleaned successfully',
      details: userRole === 'teacher' ? 'Classes reassigned to SuperAdmin.' : 'All student records purged.'
    });
  } catch (err) {
    console.error('DB Error in DELETE /api/users/:id:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to delete user and clean records' });
  }
});

module.exports = router;
