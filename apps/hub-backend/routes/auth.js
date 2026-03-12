const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hayford_key_2026';

// Register User - STUDENTS ONLY (Multi-Tenant SaaS) OR Teacher/Admin creation by authorized users
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, role, institution_id } = req.body;
  
  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if this is a teacher/admin creation request
  const isCreatingTeacherOrAdmin = role && (role === 'teacher' || role === 'admin');
  
  if (isCreatingTeacherOrAdmin) {
    // Verify the requester is authorized (admin or super_admin)
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required to create teacher/admin accounts' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const requesterRole = decoded.user.role;
      
      if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
        return res.status(403).json({ 
          error: 'Only admins can create teacher accounts' 
        });
      }

      // Determine institution_id: super_admin can specify, admin uses their own
      let targetInstitutionId;
      if (requesterRole === 'super_admin') {
        // Super admin must provide institution_id
        if (!institution_id) {
          return res.status(400).json({ error: 'Super admin must specify institution_id' });
        }
        targetInstitutionId = institution_id;
      } else {
        // Regular admin uses their own institution_id
        targetInstitutionId = decoded.user.institution_id;
      }

      // Create teacher/admin account
      const connection = await pool.getConnection();
      
      const [existing] = await connection.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.length > 0) {
        connection.release();
        return res.status(409).json({ error: 'Email already registered' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      
      const [result] = await connection.query(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, institution_id, class_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [first_name, last_name, email, password_hash, role, targetInstitutionId, null]
      );
      
      connection.release();
      return res.status(201).json({ message: `${role} account created successfully`, userId: result.insertId });
      
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Student self-registration
  if (role && role !== 'student') {
    return res.status(403).json({ 
      error: 'Teacher and Admin accounts must be created by your Institution Administrator. Please contact your admin or support@hayfordglobal.com.' 
    });
  }

  try {
    const connection = await pool.getConnection();
    
    const [existing] = await connection.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      connection.release();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    const [result] = await connection.query(
      'INSERT INTO users (first_name, last_name, email, password_hash, role, institution_id, class_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [first_name, last_name, email, password_hash, 'student', null, null]
    );
    
    connection.release();
    res.status(201).json({ message: 'Student account created successfully', userId: result.insertId });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login User - Multi-Tenant with Institution Context
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Allow teacher/admin/super_admin to login with 'teacher' role selection
    let query, params;
    if (role === 'teacher') {
      query = 'SELECT * FROM users WHERE email = $1 AND role IN ($2, $3, $4)';
      params = [email, 'teacher', 'admin', 'super_admin'];
    } else {
      query = 'SELECT * FROM users WHERE email = $1 AND role = $2';
      params = [email, role];
    }
    
    const [users] = await connection.query(query, params);
    
    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      connection.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch class name if student is enrolled
    let class_name = null;
    if (user.role === 'student' && user.class_id) {
      const [classRows] = await connection.query('SELECT class_name FROM classes WHERE id = $1', [user.class_id]);
      if (classRows.length > 0) {
        class_name = classRows[0].class_name;
      }
    }

    connection.release();

    // Generate JWT with institution_id for tenant isolation
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        institution_id: user.institution_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        class_id: user.class_id,
        class_name
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: payload.user });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
