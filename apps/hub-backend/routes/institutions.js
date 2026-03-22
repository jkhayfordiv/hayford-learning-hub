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
        COUNT(DISTINCT linked_users.id) AS student_count
      FROM institutions i
      LEFT JOIN (
        -- Users directly linked to the institution
        SELECT id, role, institution_id FROM users WHERE institution_id IS NOT NULL
        UNION
        -- Users linked via class enrollment (in case institution_id was never set on the user)
        SELECT u.id, u.role, c.institution_id
        FROM class_enrollments ce
        JOIN users u ON u.id = ce.user_id
        JOIN classes c ON c.id = ce.class_id
      ) AS linked_users ON linked_users.institution_id = i.id
      GROUP BY i.id
      ORDER BY i.id ASC
    `);
    
    // Ensure counts are numbers
    const institutionsWithCount = institutions.map(inst => ({
      ...inst,
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

// PUT update institution
router.put('/:id', verifySuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, address, contact_email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Institution name is required' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE institutions SET name = $1, address = $2, contact_email = $3 WHERE id = $4',
      [name, address || null, contact_email || null, id]
    );
    connection.release();
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    if (updated === 0) {
      return res.status(404).json({ error: 'Institution not found' });
    }
    res.json({ message: 'Institution updated successfully' });
  } catch (err) {
    console.error('DB Error in PUT /api/institutions/:id:', err.message);
    res.status(500).json({ error: 'Failed to update institution' });
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
