const express = require('express');
const multer = require('multer');
const router = express.Router();
const { gradeIeltsSpeaking, gradeIeltsSpeakingAudio } = require('../services/aiService');
const authenticateToken = require('../middleware/auth');
const { pool } = require('../db');

const VALID_WEAKNESS_CATEGORIES = [
  'Article Usage', 'Countability & Plurals', 'Pronoun Reference', 'Prepositional Accuracy',
  'Word Forms', 'Subject-Verb Agreement', 'Tense Consistency', 'Present Perfect vs. Past Simple',
  'Gerunds vs. Infinitives', 'Passive Voice Construction', 'Sentence Boundaries (Fragments/Comma Splices)',
  'Relative Clauses', 'Subordination', 'Word Order', 'Parallel Structure', 'Transitional Devices',
  'Collocations', 'Academic Register', 'Nominalization', 'Hedging'
];

async function persistSpeakingWeaknesses(userId, identifiedErrors) {
  if (!userId || !Array.isArray(identifiedErrors) || identifiedErrors.length === 0) return;
  try {
    const connection = await pool.getConnection();
    for (const category of identifiedErrors) {
      if (VALID_WEAKNESS_CATEGORIES.includes(category)) {
        await connection.query(
          `INSERT INTO user_weaknesses (user_id, category, error_count, last_updated)
           VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, category)
           DO UPDATE SET error_count = user_weaknesses.error_count + 1, last_updated = CURRENT_TIMESTAMP`,
          [userId, category]
        );
      }
    }
    connection.release();
  } catch (err) {
    console.error('[IELTS] Failed to persist weaknesses:', err.message);
  }
}

// Use memory storage — audio buffer is passed directly to Gemini without touching disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

// @route   POST /api/ielts/evaluate
// @desc    Evaluate IELTS Speaking via real audio (Gemini multimodal) - supports multi-part submissions
// @access  Private
router.post('/evaluate', authenticateToken, upload.array('audio', 15), async (req, res) => {
  const requestId = `speak-audio-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  try {
    // Free-tier B2C users cannot access IELTS Speaking
    if (req.user.subscription_tier === 'free' && req.user.allow_b2c_payments === true) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: 'IELTS Speaking requires a Premium subscription. Upgrade to unlock unlimited Speaking practice.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No audio file uploaded. Send the audio as "audio" field(s) in multipart/form-data.' });
    }

    const { prompt, part = '1' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }

    // Handle multi-part submissions (e.g., "1,2,3")
    const parts = String(part).split(',').map(p => p.trim());
    
    console.log(`[IELTS Evaluate] Request ${requestId} — ${req.files.length} audio file(s) for Part(s) ${parts.join(', ')}`);

    // For multi-part, we'll use the first audio file for now (or combine them)
    // In a production system, you might want to concatenate audio or evaluate separately
    const primaryAudio = req.files[0];

    const result = await gradeIeltsSpeakingAudio({
      audioBuffer: primaryAudio.buffer,
      mimeType: primaryAudio.mimetype,
      questionPrompt: prompt,
      part: parts.join(','),
      requestId,
    });

    console.log(`[IELTS Evaluate] Successfully graded ${requestId}`);

    // Persist grammar weaknesses asynchronously (fire-and-forget)
    if (result.identified_errors) {
      persistSpeakingWeaknesses(req.user.id, result.identified_errors);
    }

    res.json(result);
  } catch (error) {
    console.error(`[IELTS Evaluate] Error ${requestId}:`, error);

    if (error.isTimeout) {
      return res.status(504).json({ error: 'AI grading timed out. Your recording may be too long — please try a shorter response.' });
    }
    if (error.statusCode === 429) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }

    res.status(500).json({ error: 'Failed to evaluate your speaking response. Please try again.' });
  }
});

// @route   POST /api/ielts/speak/grade  (legacy text-based route)
// @desc    Grade IELTS Speaking transcribed response
// @access  Private
router.post('/speak/grade', authenticateToken, async (req, res) => {
  const { transcript, questionPrompt, part } = req.body;
  const requestId = `speak-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    if (!transcript || !questionPrompt || !part) {
      return res.status(400).json({ 
        error: 'Missing required fields: transcript, questionPrompt, and part are required' 
      });
    }

    if (!['1', '2', '3'].includes(String(part))) {
      return res.status(400).json({ 
        error: 'Invalid part value. Must be 1, 2, or 3' 
      });
    }

    console.log(`[IELTS Speaking] Grading request ${requestId} for Part ${part}`);
    
    const result = await gradeIeltsSpeaking({
      transcript,
      questionPrompt,
      part,
      requestId
    });

    console.log(`[IELTS Speaking] Successfully graded ${requestId}`);

    // Persist grammar weaknesses asynchronously (fire-and-forget)
    if (result.identified_errors) {
      persistSpeakingWeaknesses(req.user.id, result.identified_errors);
    }

    res.json(result);
  } catch (error) {
    console.error(`[IELTS Speaking] Error grading ${requestId}:`, error);
    
    if (error.isTimeout) {
      return res.status(504).json({ 
        error: 'AI service timeout. Please try again.' 
      });
    }
    
    if (error.statusCode === 429) {
      return res.status(429).json({ 
        error: 'Too many requests. Please wait a moment and try again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to grade speaking response. Please try again.' 
    });
  }
});

module.exports = router;

