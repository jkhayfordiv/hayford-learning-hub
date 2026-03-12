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
        COUNT(u.id) as user_count
      FROM institutions i
      LEFT JOIN users u ON u.institution_id = i.id
      GROUP BY i.id, i.name, i.address, i.contact_email, i.created_at
      ORDER BY i.id ASC
    `);
    connection.release();
    res.json(institutions);
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'Failed to create institution' });
  }
});

module.exports = router;
