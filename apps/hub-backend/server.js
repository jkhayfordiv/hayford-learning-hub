require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { bootstrapDatabase, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Optional: Test the DB connection
    const connection = await pool.getConnection();
    connection.release();
    
    res.status(200).json({ 
      status: 'ok', 
      message: 'Server is running', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(503).json({ 
      status: 'error', 
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
