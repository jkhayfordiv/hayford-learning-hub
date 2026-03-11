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

Evaluate the sentence based on:
1. used_word: Did they use the target word (or a valid inflection/form of it)? true/false
2. grammar_ok: Is the sentence grammatically sound? true/false
3. context_ok: Does the context demonstrate they understand what the word means? true/false
4. explanation: A concise string explaining the grading, providing corrections if there are grammar errors, and confirming if the context was good.

Return ONLY a raw JSON object with those four keys. No markdown wrapping.
Example: {"used_word": true, "grammar_ok": false, "context_ok": true, "explanation": "Good context, but 'he run' should be 'he runs'."}
`;

  return limiter.schedule(() => executeWithRetry(prompt, requestId));
}

module.exports = {
  getVocabularyFeedback,
  AiRequestError
};
