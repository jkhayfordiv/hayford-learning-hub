const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

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

// ============================================================================
// GET /api/terms?institution_id=X
// Returns all terms for an institution (admin+ can view)
// ============================================================================
router.get('/', verifyAdminOrAbove, async (req, res) => {
  const { institution_id } = req.query;

  // Admin can only see their own institution's terms
  if (req.user.role === 'admin' && req.user.institution_id !== parseInt(institution_id, 10)) {
    return res.status(403).json({ error: 'You can only view your own institution terms' });
  }

  try {
    const connection = await pool.getConnection();
    let query, params;

    if (institution_id) {
      query = `SELECT t.*, 
                 (SELECT COUNT(*) FROM classes c WHERE c.term_id = t.id) AS class_count
               FROM terms t 
               WHERE t.institution_id = $1 
               ORDER BY t.start_date DESC`;
      params = [institution_id];
    } else if (req.user.role === 'super_admin') {
      query = `SELECT t.*, i.name AS institution_name,
                 (SELECT COUNT(*) FROM classes c WHERE c.term_id = t.id) AS class_count
               FROM terms t 
               LEFT JOIN institutions i ON t.institution_id = i.id
               ORDER BY t.institution_id, t.start_date DESC`;
      params = [];
    } else {
      query = `SELECT t.*,
                 (SELECT COUNT(*) FROM classes c WHERE c.term_id = t.id) AS class_count
               FROM terms t 
               WHERE t.institution_id = $1 
               ORDER BY t.start_date DESC`;
      params = [req.user.institution_id];
    }

    const [terms] = await connection.query(query, params);
    connection.release();
    res.json(terms);
  } catch (err) {
    console.error('Error fetching terms:', err.message);
    res.status(500).json({ error: 'Failed to fetch terms' });
  }
});

// ============================================================================
// POST /api/terms
// Create a new term (Super Admin only)
// ============================================================================
router.post('/', verifySuperAdmin, async (req, res) => {
  const { institution_id, name, start_date, end_date } = req.body;

  if (!institution_id || !name || !start_date || !end_date) {
    return res.status(400).json({ error: 'institution_id, name, start_date, and end_date are required' });
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO terms (institution_id, name, start_date, end_date, is_active) 
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [institution_id, name, start_date, end_date]
    );
    connection.release();
    res.status(201).json({ message: 'Term created', id: result[0]?.id || result.insertId });
  } catch (err) {
    console.error('Error creating term:', err.message);
    res.status(500).json({ error: 'Failed to create term' });
  }
});

// ============================================================================
// PUT /api/terms/:id
// Update a term (Super Admin only)
// ============================================================================
router.put('/:id', verifySuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, start_date, end_date, is_active } = req.body;

  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date, and end_date are required' });
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `UPDATE terms SET name = $1, start_date = $2, end_date = $3, is_active = $4 WHERE id = $5`,
      [name, start_date, end_date, is_active !== false, id]
    );
    connection.release();
    const updated = result?.affectedRows ?? result?.rowCount ?? 0;
    if (updated === 0) return res.status(404).json({ error: 'Term not found' });
    res.json({ message: 'Term updated successfully' });
  } catch (err) {
    console.error('Error updating term:', err.message);
    res.status(500).json({ error: 'Failed to update term' });
  }
});

// ============================================================================
// DELETE /api/terms/:id
// Delete a term (Super Admin only) — unlinks classes but does not delete them
// ============================================================================
router.delete('/:id', verifySuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await pool.getConnection();
    // Unlink classes from this term first
    await connection.query('UPDATE classes SET term_id = NULL WHERE term_id = $1', [id]);
    const [result] = await connection.query('DELETE FROM terms WHERE id = $1', [id]);
    connection.release();
    const deleted = result?.affectedRows ?? result?.rowCount ?? 0;
    if (deleted === 0) return res.status(404).json({ error: 'Term not found' });
    res.json({ message: 'Term deleted successfully' });
  } catch (err) {
    console.error('Error deleting term:', err.message);
    res.status(500).json({ error: 'Failed to delete term' });
  }
});

// ============================================================================
// POST /api/terms/check-archive
// Checks all terms and archives classes whose term has ended.
// Marks classes as is_active=false and assignments as view-only.
// user_vocabulary is NOT affected.
// Can be called by a cron job or on dashboard load.
// ============================================================================
router.post('/check-archive', verifyAdminOrAbove, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // 1. Find all terms that have ended (end_date < CURRENT_DATE) and are still active
    const [expiredTerms] = await connection.query(
      `SELECT id, institution_id, name FROM terms WHERE end_date < CURRENT_DATE AND is_active = true`
    );

    if (expiredTerms.length === 0) {
      connection.release();
      return res.json({ message: 'No terms to archive', archived_terms: 0, archived_classes: 0 });
    }

    let archivedClasses = 0;
    let archivedAssignments = 0;

    for (const term of expiredTerms) {
      // 2. Mark all classes linked to this term as inactive
      const [classResult] = await connection.query(
        `UPDATE classes SET is_active = false WHERE term_id = $1 AND is_active = true`,
        [term.id]
      );
      archivedClasses += classResult?.affectedRows ?? classResult?.rowCount ?? 0;

      // 3. Mark all pending assignments in those classes as view-only (status = 'archived')
      const [assignResult] = await connection.query(
        `UPDATE assigned_tasks SET status = 'archived' 
         WHERE class_id IN (SELECT id FROM classes WHERE term_id = $1) 
         AND status = 'pending'`,
        [term.id]
      );
      archivedAssignments += assignResult?.affectedRows ?? assignResult?.rowCount ?? 0;

      // 4. Mark the term itself as inactive
      await connection.query(
        `UPDATE terms SET is_active = false WHERE id = $1`,
        [term.id]
      );
    }

    // NOTE: user_vocabulary is completely untouched — SRS continues as normal.

    connection.release();
    res.json({
      message: `Archived ${expiredTerms.length} term(s)`,
      archived_terms: expiredTerms.length,
      archived_classes: archivedClasses,
      archived_assignments: archivedAssignments,
    });
  } catch (err) {
    console.error('Error in check-archive:', err.message);
    res.status(500).json({ error: 'Failed to check/archive terms' });
  }
});

module.exports = router;
