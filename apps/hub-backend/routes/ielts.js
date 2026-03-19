const express = require('express');
const router = express.Router();
const { gradeIeltsSpeaking } = require('../services/aiService');
const { authenticateToken } = require('../middleware/auth');

// @route   POST /api/ielts/speak/grade
// @desc    Grade IELTS Speaking transcribed response
// @access  Private (Student)
router.post('/speak/grade', authenticateToken, async (req, res) => {
  const { transcript, questionPrompt, part } = req.body;
  const requestId = `speak-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Validate required fields
    if (!transcript || !questionPrompt || !part) {
      return res.status(400).json({ 
        error: 'Missing required fields: transcript, questionPrompt, and part are required' 
      });
    }

    // Validate part is 1, 2, or 3
    if (!['1', '2', '3'].includes(String(part))) {
      return res.status(400).json({ 
        error: 'Invalid part value. Must be 1, 2, or 3' 
      });
    }

    // Call AI service to grade the speaking response
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
