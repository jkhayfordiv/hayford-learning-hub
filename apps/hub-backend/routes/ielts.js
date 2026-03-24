const express = require('express');
const multer = require('multer');
const router = express.Router();
const { gradeIeltsSpeaking, gradeIeltsSpeakingAudio } = require('../services/aiService');
const authenticateToken = require('../middleware/auth');

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
router.post('/evaluate', authenticateToken, upload.array('audio', 3), async (req, res) => {
  const requestId = `speak-audio-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  try {
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

