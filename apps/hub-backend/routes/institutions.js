const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET is not defined'); process.exit(1); }

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

// GET all institutions with user counts
router.get('/', verifySuperAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [institutions] = await connection.query(`
      SELECT 
        i.id,
        i.name,
        i.address,
        i.contact_email,
        i.created_at,
        CAST(COUNT(u.id) AS INTEGER) as total_users,
        CAST(COUNT(CASE WHEN u.role = 'student' THEN u.id END) AS INTEGER) as student_count
      FROM institutions i
      LEFT JOIN users u ON u.institution_id = i.id
      GROUP BY i.id
      ORDER BY i.id ASC
    `);
    
    // Ensure counts are numbers
    const institutionsWithCount = institutions.map(inst => ({
      ...inst,
      total_users: parseInt(inst.total_users) || 0,
      student_count: parseInt(inst.student_count) || 0
    }));
    
    connection.release();
    res.json(institutionsWithCount);
  } catch (err) {
    console.error('DB Error in GET /api/institutions:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
});

// POST create new institution
router.post('/', verifySuperAdmin, async (req, res) => {
  const { name, address, contact_email } = req.body;
  
  if (!name || !contact_email) {
    return res.status(400).json({ error: 'Name and contact email are required' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO institutions (name, address, contact_email) VALUES ($1, $2, $3) RETURNING id',
      [name, address || null, contact_email]
    );
    connection.release();
    res.status(201).json({ message: 'Institution created', id: result.insertId });
  } catch (err) {
    console.error('DB Error in POST /api/institutions:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to create institution' });
  }
});

// DELETE institution permanently
router.delete('/:id', verifySuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await pool.getConnection();
    
    // Check if institution has users
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users WHERE institution_id = $1', [id]);
    if (users[0].count > 0) {
      connection.release();
      return res.status(400).json({ error: `Cannot delete institution with ${users[0].count} user(s). Please reassign or delete users first.` });
    }
    
    // Check if institution has classes
    const [classes] = await connection.query('SELECT COUNT(*) as count FROM classes WHERE institution_id = $1', [id]);
    if (classes[0].count > 0) {
      connection.release();
      return res.status(400).json({ error: `Cannot delete institution with ${classes[0].count} class(es). Please delete classes first.` });
    }
    
    // Delete the institution
    await connection.query('DELETE FROM institutions WHERE id = $1', [id]);
    connection.release();
    
    res.json({ message: 'Institution deleted successfully' });
  } catch (err) {
    console.error('DB Error in DELETE /api/institutions/:id:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Failed to delete institution' });
  }
});

module.exports = router;
