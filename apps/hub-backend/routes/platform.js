const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hayford_key_2026';

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
          u.class_id,
          c.class_name,
          u.created_at
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        LEFT JOIN classes c ON u.class_id = c.id
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
          u.class_id,
          c.class_name,
          u.created_at
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.institution_id = $1
        ORDER BY u.id ASC
      `;
      params = [actor_institution_id];
    } else {
      connection.release();
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [users] = await connection.query(query, params);
    connection.release();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH update user (role, institution_id, class_id) - Admin and SuperAdmin
router.patch('/users/:id', verifyAdminOrSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, institution_id, class_id } = req.body;

  try {
    const connection = await pool.getConnection();
    
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
    if (class_id !== undefined) {
      updates.push(`class_id = $${paramIndex++}`);
      values.push(class_id || null);
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    
    await connection.query(query, values);
    connection.release();
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE user permanently - Admin and SuperAdmin
router.delete('/users/:id', verifyAdminOrSuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await pool.getConnection();
    
    // Delete user's scores, assignments, and grammar progress first (foreign key constraints)
    await connection.query('DELETE FROM student_scores WHERE user_id = $1', [id]);
    await connection.query('DELETE FROM assigned_tasks WHERE user_id = $1', [id]);
    await connection.query('DELETE FROM grammar_progress WHERE user_id = $1', [id]);
    
    // Delete the user
    const [result] = await connection.query('DELETE FROM users WHERE id = $1', [id]);
    connection.release();
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
