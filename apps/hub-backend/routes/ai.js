const express = require('express');
const { getVocabularyFeedback, AiRequestError } = require('../services/aiService');

const router = express.Router();

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
