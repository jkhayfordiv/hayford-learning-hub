const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);
const MAX_CONCURRENT_REQUESTS = Number(process.env.AI_MAX_CONCURRENT || 4);

class AiRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AiRequestError';
    this.statusCode = options.statusCode ?? null;
    this.isTimeout = Boolean(options.isTimeout);
    this.providerBody = options.providerBody;
  }
}

class ConcurrencyLimiter {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
    this.queue = [];
  }

  schedule(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.runNext();
    });
  }

  runNext() {
    if (this.activeCount >= this.maxConcurrent) return;
    const item = this.queue.shift();
    if (!item) return;

    this.activeCount += 1;
    Promise.resolve()
      .then(item.task)
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        this.activeCount -= 1;
        this.runNext();
      });
  }
}

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_REQUESTS);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiRequestError('GEMINI_API_KEY is not configured on the backend.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    const text = await response.text();
    let parsedResponse = {};
    try {
      parsedResponse = text ? JSON.parse(text) : {};
    } catch (_) {
      parsedResponse = {};
    }

    if (!response.ok) {
      throw new AiRequestError(`Gemini HTTP ${response.status}`, {
        statusCode: response.status,
        providerBody: parsedResponse
      });
    }

    const rawText = parsedResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new AiRequestError('Gemini returned no content in response body.');
    }

    return JSON.parse(rawText.replace(/```json|```/g, '').trim());
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiRequestError(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`, { isTimeout: true });
    }
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(error.message || 'Unknown Gemini request error.');
  } finally {
    clearTimeout(timeout);
  }
}

async function executeWithRetry(prompt, requestId) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await callGemini(prompt);
    } catch (error) {
      const isRetryable = RETRYABLE_STATUS_CODES.has(error.statusCode);
      const isLastAttempt = attempt === MAX_RETRIES;

      if (!isRetryable || isLastAttempt) {
        if (error.isTimeout) {
          console.error(`[AI][${requestId}] timeout after attempt ${attempt}: ${error.message}`);
        } else if (error.statusCode === 429) {
          console.error(`[AI][${requestId}] rate limited (429) after attempt ${attempt}`, error.providerBody || '');
        } else if (error.statusCode === 503) {
          console.error(`[AI][${requestId}] provider unavailable (503) after attempt ${attempt}`, error.providerBody || '');
        } else {
          console.error(`[AI][${requestId}] non-retryable AI error on attempt ${attempt}: ${error.message}`);
        }
        throw error;
      }

      const waitMs = BASE_BACKOFF_MS * (2 ** (attempt - 1));
      console.warn(`[AI][${requestId}] retryable error ${error.statusCode} on attempt ${attempt}; retrying in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  throw new AiRequestError('AI retry loop exited unexpectedly.');
}

async function getVocabularyFeedback({ targetWord, sentence, requestId }) {
  const prompt = `
You are an English language tutor grading a vocabulary exercise.
The student was instructed to write exactly ONE sentence using the target word.

Target Word: "${targetWord}"
Student Sentence: "${sentence}"

CRITICAL: Evaluate the sentence on TWO DISTINCT AXES:

AXIS 1 - TARGET WORD USAGE (Primary):
- Did they use the specific vocabulary word correctly in meaning and form?
- Consider: word usage, correct inflection/form, and contextual understanding
- This determines if they "passed" the vocabulary drill

AXIS 2 - SECONDARY GRAMMAR (Secondary):
- Is the REST of the sentence grammatically correct?
- Consider: punctuation, capitalization, spelling of OTHER words (not the target word)
- This is helpful feedback but does NOT fail the vocabulary word itself

Return ONLY a raw JSON object with these THREE keys:
1. target_word_correct (boolean): Did they use the target word correctly in meaning and form?
2. secondary_grammar_correct (boolean): Is the rest of the sentence grammatically correct (punctuation, capitalization, other spelling)?
3. feedback (string): Helpful explanation of their errors, or praise if perfect. If target_word_correct is true but secondary_grammar_correct is false, acknowledge they used the word correctly but point out the grammar issues.

Example 1: {"target_word_correct": true, "secondary_grammar_correct": false, "feedback": "Great job using 'ephemeral' correctly to mean temporary! However, you're missing a period at the end of the sentence."}
Example 2: {"target_word_correct": false, "secondary_grammar_correct": true, "feedback": "Your sentence is grammatically perfect, but 'ephemeral' means temporary, not eternal. Try using it to describe something brief."}
Example 3: {"target_word_correct": true, "secondary_grammar_correct": true, "feedback": "Perfect! You used 'ephemeral' correctly and your sentence is grammatically sound."}

No markdown wrapping. Return only the JSON object.
`;

  return limiter.schedule(() => executeWithRetry(prompt, requestId));
}

async function gradeIeltsSpeaking({ transcript, questionPrompt, part, requestId }) {
  const prompt = `
You are an expert, strict IELTS Speaking Examiner. You are evaluating a transcribed audio response from a student. Evaluate based on: 1. Fluency and Coherence (FC) - look for discourse markers and transcribed hesitations like um/uh. 2. Lexical Resource (LR) - look for vocabulary variety. 3. Grammatical Range and Accuracy (GRA). DO NOT evaluate Pronunciation. Calculate the Overall Band Score as the average of FC, LR, and GRA, rounded down to the nearest 0.5. Return your evaluation STRICTLY as a JSON object with this exact structure: { "scores": { "fluency": 0.0, "lexical": 0.0, "grammar": 0.0, "overall": 0.0 }, "feedback": { "strengths": "1-2 sentences.", "weaknesses": "1-2 sentences highlighting specific errors.", "improvement_tip": "1 specific actionable tip." } }

Part: ${part}
Question: "${questionPrompt}"
Student Response (Transcribed): "${transcript}"

Return ONLY the JSON object. No markdown wrapping.
`;

  return limiter.schedule(() => executeWithRetry(prompt, requestId));
}

module.exports = {
  getVocabularyFeedback,
  gradeIeltsSpeaking,
  AiRequestError
};
