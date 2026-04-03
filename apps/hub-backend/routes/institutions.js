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

// Middleware to verify admin or super_admin
const verifyAdminOrAbove = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.user.role !== 'super_admin' && decoded.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to verify admin, teacher, or super_admin
const verifyAdminOrTeacher = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const role = decoded.user.role;
    if (role !== 'super_admin' && role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ error: 'Admin or Teacher access required' });
    }
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET all institutions with user counts
router.get('/', verifyAdminOrAbove, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [institutions] = await connection.query(`
      SELECT 
        i.id,
        i.name,
        i.address,
        i.contact_email,
        i.created_at,
        i.primary_color,
        i.secondary_color,
        i.welcome_text,
        i.logo_url,
        i.has_grammar_world,
        i.has_ielts_speaking,
        COALESCE(i.show_writing_on_dashboard, true) AS show_writing_on_dashboard,
        COALESCE(i.show_speaking_on_dashboard, true) AS show_speaking_on_dashboard,
        COALESCE(i.show_grammar_world_on_dashboard, true) AS show_grammar_world_on_dashboard,
        COALESCE(i.show_vocab_on_dashboard, true) AS show_vocab_on_dashboard,
        COALESCE(i.show_writing_lab_on_dashboard, true) AS show_writing_lab_on_dashboard,
        (
          SELECT COUNT(DISTINCT u.id)
          FROM users u
          LEFT JOIN class_enrollments ce ON u.id = ce.user_id
          LEFT JOIN classes c ON ce.class_id = c.id
          WHERE (u.institution_id = i.id OR c.institution_id = i.id)
            AND u.role = 'student'
        ) AS student_count
      FROM institutions i
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
  const { 
    name, address, contact_email, primary_color, secondary_color, welcome_text, logo_url,
    show_writing_on_dashboard, show_speaking_on_dashboard, show_grammar_world_on_dashboard,
    show_vocab_on_dashboard, show_writing_lab_on_dashboard
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Institution name is required' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `UPDATE institutions SET
        name = $1, address = $2, contact_email = $3,
        primary_color = COALESCE($4, primary_color),
        secondary_color = COALESCE($5, secondary_color),
        welcome_text = COALESCE($6, welcome_text),
        logo_url = COALESCE($7, logo_url),
        show_writing_on_dashboard = COALESCE($8, show_writing_on_dashboard),
        show_speaking_on_dashboard = COALESCE($9, show_speaking_on_dashboard),
        show_grammar_world_on_dashboard = COALESCE($10, show_grammar_world_on_dashboard),
        show_vocab_on_dashboard = COALESCE($11, show_vocab_on_dashboard),
        show_writing_lab_on_dashboard = COALESCE($12, show_writing_lab_on_dashboard)
       WHERE id = $13`,
      [name, address || null, contact_email || null,
       primary_color || null, secondary_color || null,
       welcome_text || null, logo_url || null,
       show_writing_on_dashboard ?? null, show_speaking_on_dashboard ?? null,
       show_grammar_world_on_dashboard ?? null, show_vocab_on_dashboard ?? null,
       show_writing_lab_on_dashboard ?? null, id]
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


// GET current app visibility settings for an institution (admin/teacher of own institution, or super_admin)
router.get('/:id/app-visibility', verifyAdminOrTeacher, async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'super_admin' && req.user.institution_id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'You can only view your own institution settings' });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT
        COALESCE(show_writing_on_dashboard, true) AS show_writing_on_dashboard,
        COALESCE(show_speaking_on_dashboard, true) AS show_speaking_on_dashboard,
        COALESCE(show_grammar_world_on_dashboard, true) AS show_grammar_world_on_dashboard,
        COALESCE(show_vocab_on_dashboard, true) AS show_vocab_on_dashboard,
        COALESCE(show_writing_lab_on_dashboard, true) AS show_writing_lab_on_dashboard,
        has_grammar_world,
        has_ielts_speaking
       FROM institutions WHERE id = $1`,
      [id]
    );
    connection.release();
    if (rows.length === 0) return res.status(404).json({ error: 'Institution not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('DB Error in GET /api/institutions/:id/app-visibility:', err.message);
    res.status(500).json({ error: 'Failed to fetch app visibility' });
  }
});

// PATCH toggle app visibility on student dashboard (admin/teacher of own institution, or super_admin)
router.patch('/:id/app-visibility', verifyAdminOrTeacher, async (req, res) => {
  const { id } = req.params;
  const { app, show_on_dashboard } = req.body;

  const VALID_APPS = ['writing', 'speaking', 'grammar_world', 'vocab', 'writing_lab'];
  const COLUMN_MAP = {
    writing:      'show_writing_on_dashboard',
    speaking:     'show_speaking_on_dashboard',
    grammar_world:'show_grammar_world_on_dashboard',
    vocab:        'show_vocab_on_dashboard',
    writing_lab:  'show_writing_lab_on_dashboard',
  };

  if (!VALID_APPS.includes(app)) {
    return res.status(400).json({ error: `Invalid app. Must be one of: ${VALID_APPS.join(', ')}` });
  }
  if (typeof show_on_dashboard !== 'boolean') {
    return res.status(400).json({ error: 'show_on_dashboard must be a boolean' });
  }

  // Non-super_admin can only update their own institution
  if (req.user.role !== 'super_admin' && req.user.institution_id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'You can only manage your own institution settings' });
  }

  try {
    const connection = await pool.getConnection();
    const column = COLUMN_MAP[app];
    const [result] = await connection.query(
      `UPDATE institutions SET ${column} = $1 WHERE id = $2`,
      [show_on_dashboard, id]
    );
    connection.release();
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    if (updated === 0) {
      return res.status(404).json({ error: 'Institution not found' });
    }
    res.json({ success: true, app, show_on_dashboard });
  } catch (err) {
    console.error('DB Error in PATCH /api/institutions/:id/app-visibility:', err.message);
    res.status(500).json({ error: 'Failed to update app visibility' });
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
