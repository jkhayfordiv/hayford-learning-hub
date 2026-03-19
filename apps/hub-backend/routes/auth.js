const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET is not defined'); process.exit(1); }

// Register User - STUDENTS ONLY (Multi-Tenant SaaS) OR Teacher/Admin creation by authorized users
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, role, institution_id } = req.body;
  
  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if this is a privileged creation request
  const isPrivilegedRequest = role && (role === 'teacher' || role === 'admin' || role === 'student');
  
  if (isPrivilegedRequest && req.headers.authorization) {
    // Verify the requester is authorized (admin or super_admin)
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required for privileged account creation' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const requesterRole = decoded.user.role;
      
      // SuperAdmins can create anyone. Admins can create anyone except other SuperAdmins (usually).
      if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
        // Fall through to self-registration if it's just a student role or error out if it says teacher/admin
        if (role !== 'student') {
          return res.status(403).json({ error: 'Only admins can create teacher/admin accounts' });
        }
      } else {
        // Authorized creation
        let targetInstitutionId;
        if (requesterRole === 'super_admin') {
          targetInstitutionId = institution_id; // Can be null for independent students or specified
        } else {
          targetInstitutionId = decoded.user.institution_id;
        }

        const connection = await pool.getConnection();
        
        // Check if email+role combination already exists (not just email)
        const [existing] = await connection.query('SELECT id FROM users WHERE email = $1 AND role = $2', [email, role]);
        if (existing.length > 0) {
          connection.release();
          return res.status(409).json({ error: `An account with this email already exists for the ${role} role` });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        const [result] = await connection.query(
          'INSERT INTO users (first_name, last_name, email, password_hash, role, institution_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [first_name, last_name, email, password_hash, role, targetInstitutionId]
        );
        
        connection.release();
        return res.status(201).json({ message: `${role} account created successfully`, userId: result.insertId });
      }
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      console.error('DB Error in POST /api/auth/register (privileged creation):', err.message);
      console.error('Full error:', err);
      if (err.query) console.error('Failed query:', err.query);
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
    
    // Check if email+role combination already exists (allows same email for different roles)
    const [existing] = await connection.query('SELECT id FROM users WHERE email = $1 AND role = $2', [email, 'student']);
    if (existing.length > 0) {
      connection.release();
      return res.status(409).json({ error: 'A student account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    const [result] = await connection.query(
      'INSERT INTO users (first_name, last_name, email, password_hash, role, institution_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [first_name, last_name, email, password_hash, 'student', null]
    );
    
    connection.release();
    res.status(201).json({ message: 'Student account created successfully', userId: result.insertId });
    
  } catch (err) {
    console.error('DB Error in POST /api/auth/register (student self-registration):', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login User - Multi-Tenant with Institution Context + Role-Based Login Gates
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Query by BOTH email AND role to support multiple profiles per email
    // Allow teacher/admin/super_admin to login with 'teacher' role selection
    let query, params;
    if (role === 'teacher') {
      // Use ANY with array for PostgreSQL IN clause
      query = 'SELECT * FROM users WHERE email = $1 AND role = ANY($2)';
      params = [email, ['teacher', 'admin', 'super_admin']];
    } else {
      // Exact role match for students
      query = 'SELECT * FROM users WHERE email = $1 AND role = $2';
      params = [email, role];
    }
    
    const [users] = await connection.query(query, params);
    
    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ error: 'Invalid credentials or no account found for this role' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      connection.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch enrolled classes for the user (supports multiple enrollments)
    let classes = [];
    const [enrollmentRows] = await connection.query(
      `SELECT c.id, c.class_name, c.class_code, ce.joined_at
       FROM class_enrollments ce
       JOIN classes c ON ce.class_id = c.id
       WHERE ce.user_id = $1
       ORDER BY ce.joined_at DESC`,
      [user.id]
    );
    
    if (enrollmentRows.length > 0) {
      classes = enrollmentRows;
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
        classes: classes, // Array of enrolled classes
        class_id: classes.length > 0 ? classes[0].id : null, // Backwards compatibility: first class
        class_name: classes.length > 0 ? classes[0].class_name : null // Backwards compatibility
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: payload.user });
    });

  } catch (err) {
    console.error('DB Error in POST /api/auth/login:', err.message);
    console.error('Full error:', err);
    if (err.query) console.error('Failed query:', err.query);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
