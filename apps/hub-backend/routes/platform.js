const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hayford_key_2026';

// Middleware to verify super_admin
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

// GET all users across all institutions
router.get('/users/all', verifySuperAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        email, 
        role, 
        institution_id, 
        class_id,
        created_at
      FROM users
      ORDER BY id ASC
    `);
    connection.release();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH update user (role, institution_id, class_id)
router.patch('/users/:id', verifySuperAdmin, async (req, res) => {
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

module.exports = router;
