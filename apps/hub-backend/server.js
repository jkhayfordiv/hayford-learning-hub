require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { bootstrapDatabase, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173', // Local Vite development
  'http://localhost:3001', // Local backend (for some tools)
  'https://hayford-learning-hub.onrender.com', // Current deployment fallback
  'https://hub.hayfordacademy.com', // Production frontend (Hostinger)
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Optional: Test the DB connection
    const connection = await pool.getConnection();
    connection.release();
    
    res.status(200).json({ 
      status: 'ok', 
      uptime: process.uptime(),
      message: 'Server is running', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(503).json({ 
      status: 'error', 
      uptime: process.uptime(),
      message: 'Server is running, but database connection failed',
      error: error.message
    });
  }
});

// Authentication Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Score Routes
const scoresRoutes = require('./routes/scores');
app.use('/api/scores', scoresRoutes);

// Classes Routes
const classesRoutes = require('./routes/classes');
app.use('/api/classes', classesRoutes);

// Assignment Routes
const assignmentsRoutes = require('./routes/assignments');
app.use('/api/assignments', assignmentsRoutes);

// Users (teacher actions: assign class, etc.)
const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);

// Grammar progress routes
const grammarProgressRoutes = require('./routes/grammarProgress');
app.use('/api/grammar-progress', grammarProgressRoutes);

// AI routes
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

// Bulk action routes (Multi-Tenant SaaS)
const bulkRoutes = require('./routes/bulk');
app.use('/api/bulk', bulkRoutes);

// Platform management routes (Admin/Super Admin)
const platformRoutes = require('./routes/platform');
app.use('/api', platformRoutes);

// Institutions routes (Super Admin)
const institutionsRoutes = require('./routes/institutions');
app.use('/api/institutions', institutionsRoutes);

// Word Bank routes (Student vocabulary management)
const wordbankRoutes = require('./routes/wordbank');
app.use('/api/wordbank', wordbankRoutes);

// IELTS routes (Speaking, Writing, etc.)
const ieltsRoutes = require('./routes/ielts');
app.use('/api/ielts', ieltsRoutes);

// Grammar World Map routes
const grammarRoutes = require('./routes/grammar');
app.use('/api/grammar', grammarRoutes);

// 404 for API routes - return JSON so clients don't get HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Global error handler - ensure JSON response
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error', details: err.message });
});

// Start Server
async function startServer() {
  try {
    await bootstrapDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Hub Backend API is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to bootstrap database schema:', error);
    process.exit(1);
  }
}

startServer();
