require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, pool } = require('./db');

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

// Start Server
app.listen(PORT, async () => {
  await initDb();
  console.log(`🚀 Hub Backend API is running on http://localhost:${PORT}`);
});
