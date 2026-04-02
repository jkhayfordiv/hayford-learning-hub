require('dotenv').config();
const dns = require('dns');

// Force IPv4-first DNS resolution to avoid ENETUNREACH on Render
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { bootstrapDatabase, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Render's proxy so rate limiting and IP detection work correctly
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet: Sets various HTTP headers for security
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API-only backend
  crossOriginEmbedderPolicy: false // Allow embedding if needed
}));

// CORS: Dynamic origin validation for multi-tenant subdomains
const allowedOrigins = [
  'http://localhost:5173', // Local Vite development
  'http://localhost:3001', // Local backend (for some tools)
  'https://hayford-learning-hub.onrender.com', // Current deployment fallback
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check exact matches from allowedOrigins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Allow any subdomain of hayfordacademy.com (e.g., hub.hayfordacademy.com, nic.hayfordacademy.com)
    if (origin.match(/^https:\/\/[a-z0-9-]+\.hayfordacademy\.com$/)) {
      return callback(null, true);
    }
    
    // Reject all other origins
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate Limiting: General API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs (permissive for normal app use)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate Limiting: Strict auth protection (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login/signup attempts per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins against the limit
});

// Apply general rate limiter to all /api routes
app.use('/api/', apiLimiter);

// Apply strict rate limiter to auth routes
app.use('/api/auth/', authLimiter);

// ============================================================================
// STRIPE WEBHOOK RAW BODY PARSER
// ============================================================================
// CRITICAL: Stripe webhooks require raw body for signature verification
// This MUST come BEFORE express.json() to intercept the webhook route
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Body parser (for all other routes)
app.use(express.json());

// ============================================================================
// ROUTES
// ============================================================================

// Health Check Endpoint (excluded from rate limiting for monitoring)
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

// Stripe payment routes
const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe', stripeRoutes);

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

// Vocab Lab routes (SRS-powered vocabulary engine)
const vocabLabRoutes = require('./routes/vocabLab');
app.use('/api/vocab-lab', vocabLabRoutes);

// IELTS routes (Speaking, Writing, etc.)
const ieltsRoutes = require('./routes/ielts');
app.use('/api/ielts', ieltsRoutes);

// Grammar World Map routes
const grammarRoutes = require('./routes/grammar');
app.use('/api/grammar', grammarRoutes);

// Writing Lab routes
const writingLabRoutes = require('./routes/writingLab');
app.use('/api/writing-lab', writingLabRoutes);

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
