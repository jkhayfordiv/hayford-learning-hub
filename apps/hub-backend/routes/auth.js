const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET is not defined'); process.exit(1); }

// Google OAuth Client Setup
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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
    
    let query, params;
    if (role === 'teacher') {
      query = `
        SELECT u.*, 
               i.subdomain, i.timezone, i.has_grammar_world, i.has_ielts_speaking,
               i.subscription_tier, i.subscription_status
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        WHERE u.email = $1 AND u.role = ANY($2)
      `;
      params = [email, ['teacher', 'admin', 'super_admin']];
    } else {
      query = `
        SELECT u.*, 
               i.subdomain, i.timezone, i.has_grammar_world, i.has_ielts_speaking,
               i.subscription_tier, i.subscription_status
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        WHERE u.email = $1 AND u.role = $2
      `;
      params = [email, role];
    }
    
    const [users] = await connection.query(query, params);
    
    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ error: 'Invalid credentials or no account found for this role' });
    }

    const user = users[0];

    // SECURITY GUARD: If user signed up with Google, they won't have a password hash
    if (!user.password_hash) {
      connection.release();
      return res.status(401).json({ error: 'This account uses Google Login. Please click "Continue with Google".' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      connection.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last_login_at timestamp
    await connection.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Fetch enrolled classes for the user
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

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        institution_id: user.institution_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        classes: classes,
        class_id: classes.length > 0 ? classes[0].id : null,
        class_name: classes.length > 0 ? classes[0].class_name : null,
        subdomain: user.subdomain,
        timezone: user.timezone || 'Asia/Tokyo',
        has_grammar_world: user.has_grammar_world !== false,
        has_ielts_speaking: user.has_ielts_speaking !== false,
        subscription_tier: user.subscription_tier || 'free',
        subscription_status: user.subscription_status || 'active',
        avatar_url: user.avatar_url
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: payload.user });
    });

  } catch (err) {
    console.error('DB Error in POST /api/auth/login:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   GET api/auth/google
// @desc    Redirect to Google OAuth consent screen
router.get('/google', (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
  });
  res.redirect(url);
});

// @route   GET api/auth/google/callback
// @desc    Google OAuth callback - exchange code for user profile and generate JWT
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}/login?error=no_code`);

  let connection;
  try {
    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();

    connection = await pool.getConnection();

    // Find user by google_id or email
    let [users] = await connection.query(
      `SELECT u.*, i.subdomain, i.timezone, i.has_grammar_world, i.has_ielts_speaking, i.subscription_tier, i.subscription_status
       FROM users u LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE u.google_id = $1`,
      [profile.sub]
    );

    let user;
    if (users.length === 0) {
      // Try by email to link existing account
      const [emailUsers] = await connection.query(
        `SELECT u.*, i.subdomain, i.timezone, i.has_grammar_world, i.has_ielts_speaking, i.subscription_tier, i.subscription_status
         FROM users u LEFT JOIN institutions i ON u.institution_id = i.id
         WHERE u.email = $1 AND u.role = 'student'`,
        [profile.email]
      );

      if (emailUsers.length > 0) {
        // Link account
        await connection.query(
          'UPDATE users SET google_id = $1, avatar_url = $2, last_login_at = CURRENT_TIMESTAMP WHERE id = $3',
          [profile.sub, profile.picture, emailUsers[0].id]
        );
        user = { ...emailUsers[0], google_id: profile.sub, avatar_url: profile.picture };
      } else {
        // Create new user (Tenant 1 = Hayford B2C)
        const [result] = await connection.query(
          'INSERT INTO users (first_name, last_name, email, google_id, avatar_url, role, institution_id, last_login_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id',
          [profile.given_name || 'Student', profile.family_name || '', profile.email, profile.sub, profile.picture, 'student', 1]
        );

        // Fetch new user with joins
        const [reFetched] = await connection.query(
          `SELECT u.*, i.subdomain, i.timezone, i.has_grammar_world, i.has_ielts_speaking, i.subscription_tier, i.subscription_status
           FROM users u LEFT JOIN institutions i ON u.institution_id = i.id
           WHERE u.id = $1`,
          [result.insertId]
        );
        user = reFetched[0];
      }
    } else {
      user = users[0];
      await connection.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }

    // Fetch classes
    const [classes] = await connection.query(
      `SELECT c.id, c.class_name, c.class_code FROM class_enrollments ce JOIN classes c ON ce.class_id = c.id WHERE ce.user_id = $1 ORDER BY ce.joined_at DESC`,
      [user.id]
    );

    connection.release();

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        institution_id: user.institution_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        classes: classes,
        class_id: classes.length > 0 ? classes[0].id : null,
        class_name: classes.length > 0 ? classes[0].class_name : null,
        subdomain: user.subdomain,
        timezone: user.timezone || 'Asia/Tokyo',
        has_grammar_world: user.has_grammar_world !== false,
        has_ielts_speaking: user.has_ielts_speaking !== false,
        subscription_tier: user.subscription_tier || 'free',
        subscription_status: user.subscription_status || 'active',
        avatar_url: user.avatar_url
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.redirect(`${FRONTEND_URL}/auth/success?token=${token}`);
    });
  } catch (err) {
    console.error('Google Callback Error:', err);
    if (connection) connection.release();
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

module.exports = router;

