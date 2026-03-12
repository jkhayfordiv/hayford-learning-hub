const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getVocabularyFeedback, AiRequestError } = require('../services/aiService');

const router = express.Router();

// POST /api/ai/mark - Secure AI marking proxy
router.post('/mark', async (req, res) => {
  try {
    const { prompt, responseSchema, systemInstruction } = req.body;
    
    // Get API key from environment variables (secure on Render)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured on server' 
      });
    }
    
    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseSchema: responseSchema,
        responseMimeType: 'application/json',
      },
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction }]
      } : undefined
    });
    
    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return res.status(500).json({ 
        error: 'Invalid AI response format' 
      });
    }
    
    res.json(parsedResponse);
    
  } catch (error) {
    console.error('AI marking error:', error);
    
    // Handle specific Google API errors
    if (error.message.includes('API_KEY_INVALID')) {
      return res.status(500).json({ 
        error: 'Invalid API key configured on server' 
      });
    }
    
    if (error.message.includes('QUOTA_EXCEEDED')) {
      return res.status(429).json({ 
        error: 'API quota exceeded. Please try again later.' 
      });
    }
    
    res.status(500).json({ 
      error: 'AI service temporarily unavailable' 
    });
  }
});

router.post('/vocabulary-feedback', async (req, res) => {
  const { targetWord, sentence } = req.body || {};

  if (!targetWord || !sentence) {
    return res.status(400).json({ error: 'targetWord and sentence are required.' });
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const feedback = await getVocabularyFeedback({ targetWord, sentence, requestId });
    return res.json(feedback);
  } catch (error) {
    if (error instanceof AiRequestError) {
      if (error.statusCode === 429) {
        return res.status(429).json({ error: 'AI provider rate limit reached. Please retry shortly.', code: 'AI_RATE_LIMIT' });
      }
      if (error.statusCode === 503) {
        return res.status(503).json({ error: 'AI provider temporarily unavailable. Please retry shortly.', code: 'AI_UNAVAILABLE' });
      }
      if (error.isTimeout) {
        return res.status(504).json({ error: 'AI request timed out. Please retry.', code: 'AI_TIMEOUT' });
      }
      return res.status(502).json({ error: 'AI service failed to return a valid response.', code: 'AI_BAD_RESPONSE' });
    }

    return res.status(500).json({ error: 'Unexpected AI service error.', code: 'AI_UNKNOWN' });
  }
});

module.exports = router;
