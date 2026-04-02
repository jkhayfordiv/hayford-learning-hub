const { GoogleGenerativeAI } = require('@google/generative-ai');
const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);
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
 
CRITICAL PUNCTUATION RULES - READ CAREFULLY:
1. COMPLETELY IGNORE end-of-sentence punctuation (periods, question marks, exclamation marks)
2. DO NOT EVER mention missing periods, extra periods, or any end punctuation issues
3. DO NOT EVER mention "space before period" or "space before punctuation" in your feedback
4. These are false positives that frustrate students - the student's text is transmitted correctly
5. If you think you see any punctuation or spacing issues, IGNORE THEM - they are artifacts of text processing
6. Focus ONLY on: capitalization of first word, spelling of OTHER words (not target word), subject-verb agreement, and word choice
7. NEVER comment on punctuation, periods, commas, spacing, or formatting issues

WHAT TO CHECK FOR SECONDARY GRAMMAR:
✓ Capitalization of first word
✓ Spelling of non-target words
✓ Subject-verb agreement
✓ Basic grammar structure
✓ Word choice and usage

WHAT TO NEVER MENTION:
✗ Missing period at end
✗ Extra periods
✗ Any punctuation issues
✗ Space before period
✗ Space before comma
✗ Space before any punctuation
✗ Formatting or spacing issues

CRITICAL ERROR TRACKING: You must identify specific error categories from the student's sentence. Use ONLY these standardized categories:
- "Article Usage"
- "Countability & Plurals"
- "Pronoun Reference"
- "Prepositional Accuracy"
- "Word Forms"
- "Subject-Verb Agreement"
- "Tense Consistency"
- "Present Perfect vs. Past Simple"
- "Gerunds vs. Infinitives"
- "Passive Voice Construction"
- "Sentence Boundaries (Fragments/Comma Splices)"
- "Relative Clauses"
- "Subordination"
- "Word Order"
- "Parallel Structure"
- "Transitional Devices"
- "Collocations"
- "Academic Register"
- "Nominalization"
- "Hedging"

Do NOT invent new categories. Return an array of identified_errors containing ONLY the categories where the student made mistakes. If the sentence is perfect, return an empty array.

Return ONLY a raw JSON object with these FOUR keys:
1. target_word_correct (boolean): Did they use the target word correctly in meaning and form?
2. secondary_grammar_correct (boolean): Is the rest of the sentence grammatically correct (capitalization, spelling of OTHER words)?
3. feedback (string): Helpful explanation of their errors, or praise if perfect. If target_word_correct is true but secondary_grammar_correct is false, acknowledge they used the word correctly but point out the grammar issues. Explicitly mention the text you are correcting.
4. identified_errors (array): Array of error category strings from the list above. Empty array if no errors.

Example 1: {"target_word_correct": true, "secondary_grammar_correct": false, "feedback": "Great job using 'ephemeral' correctly to mean temporary! However, you need to capitalize the first word of the sentence.", "identified_errors": []}
Example 2: {"target_word_correct": false, "secondary_grammar_correct": false, "feedback": "You need to capitalize the first word. Also, 'ephemeral' means temporary, not eternal. Try using it to describe something brief.", "identified_errors": ["Collocations"]}
Example 3: {"target_word_correct": true, "secondary_grammar_correct": false, "feedback": "Great job using 'ephemeral' correctly! However, there's a subject-verb agreement error: 'The moments was' should be 'The moments were'.", "identified_errors": ["Subject-Verb Agreement"]}
Example 4: {"target_word_correct": true, "secondary_grammar_correct": true, "feedback": "Perfect! You used 'ephemeral' correctly and your sentence is grammatically sound.", "identified_errors": []}

No markdown wrapping. Return only the JSON object.
`;

  const result = await limiter.schedule(() => executeWithRetry(prompt, requestId));
  
  // Post-processing filter: Remove any punctuation-related feedback
  if (result && result.feedback) {
    const originalFeedback = result.feedback;
    
    // Remove all punctuation-related mentions (case-insensitive)
    result.feedback = result.feedback
      .replace(/\s*[,;]?\s*(?:but|however|also|and)?\s*(?:you\s+)?(?:should\s+)?(?:not\s+)?(?:have\s+)?(?:a\s+)?space\s+before\s+(?:the\s+)?(?:period|comma|punctuation|\.)[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:avoid|remove|don't\s+(?:add|use|put)|shouldn't\s+(?:add|use|put))\s+(?:a\s+)?space\s+before\s+(?:the\s+)?(?:period|comma|punctuation|\.)[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:no\s+)?space\s+before\s+(?:the\s+)?(?:period|comma|punctuation|\.)\s+(?:is\s+)?(?:not\s+)?(?:needed|required|necessary)[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:but|however|also|and)?\s*(?:you\s+)?(?:are\s+)?(?:missing|need|forgot)\s+(?:a\s+)?(?:period|punctuation|punctutation mark)[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:add|include|use)\s+(?:a\s+)?(?:period|punctuation|punctuation mark)\s+(?:at\s+)?(?:the\s+)?end[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:your\s+)?sentence\s+(?:needs|requires)\s+(?:a\s+)?(?:period|punctuation)[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:missing|no|without)\s+(?:a\s+)?(?:period|punctuation)[^.!?]*/gi, '')
      .replace(/\s*[,;]?\s*(?:extra|additional|unnecessary)\s+(?:period|punctuation)[^.!?]*/gi, '')
      .trim();
    
    // Clean up any double spaces or punctuation issues from removal
    result.feedback = result.feedback
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?])/g, '$1')
      .replace(/([.,!?])\s*([.,!?])/g, '$1 ')
      .trim();
    
    // If feedback became empty or too short after filtering, mark as perfect
    if (!result.feedback || result.feedback.length < 10) {
      if (result.target_word_correct) {
        result.secondary_grammar_correct = true;
        result.feedback = `Perfect! You used '${targetWord}' correctly and your sentence is grammatically sound.`;
      }
    }
    
    // Log if we filtered out false positives
    if (originalFeedback !== result.feedback) {
      console.log(`[Vocab Filter] Removed false positive space error. Original: "${originalFeedback}" -> Filtered: "${result.feedback}"`);
    }
  }
  
  return result;
}

async function gradeIeltsSpeaking({ transcript, questionPrompt, part, requestId }) {
  const prompt = `
You are an expert, strict IELTS Speaking Examiner. You are evaluating a transcribed audio response from a student. Evaluate based on: 1. Fluency and Coherence (FC) - look for discourse markers and transcribed hesitations like um/uh. 2. Lexical Resource (LR) - look for vocabulary variety. 3. Grammatical Range and Accuracy (GRA). DO NOT evaluate Pronunciation. Calculate the Overall Band Score as the average of FC, LR, and GRA, rounded down to the nearest 0.5.

CRITICAL ERROR TRACKING: Identify specific grammar error categories from ONLY this list:
"Article Usage", "Countability & Plurals", "Pronoun Reference", "Prepositional Accuracy", "Word Forms", "Subject-Verb Agreement", "Tense Consistency", "Present Perfect vs. Past Simple", "Gerunds vs. Infinitives", "Passive Voice Construction", "Sentence Boundaries (Fragments/Comma Splices)", "Relative Clauses", "Subordination", "Word Order", "Parallel Structure", "Transitional Devices", "Collocations", "Academic Register", "Nominalization", "Hedging"

Return your evaluation STRICTLY as a JSON object with this exact structure:
{"scores":{"fluency":0.0,"lexical":0.0,"grammar":0.0,"overall":0.0},"feedback":{"strengths":"1-2 sentences.","weaknesses":"1-2 sentences highlighting specific errors.","improvement_tip":"1 specific actionable tip."},"identified_errors":["Category1"]}

Part: ${part}
Question: "${questionPrompt}"
Student Response (Transcribed): "${transcript}"

Return ONLY the JSON object. No markdown wrapping.
`;

  return limiter.schedule(() => executeWithRetry(prompt, requestId));
}

async function gradeIeltsSpeakingAudio({ audioBuffer, mimeType, questionPrompt, part, requestId }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiRequestError('GEMINI_API_KEY is not configured on the backend.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const systemInstruction = `You are a fair, professional IELTS Speaking Examiner. You are listening to real audio of a student responding to an IELTS Speaking test.

Test Part(s): ${part}
${part.includes(',') ? 'NOTE: This is a multi-part test. Evaluate the student\'s overall performance across all parts.' : ''}

SCORING CALIBRATION (VERY IMPORTANT):
- A student who speaks fluently, stays on topic, uses a good range of vocabulary and grammar with only minor errors, and is clearly intelligible should score 7.0-8.0.
- A student who speaks fluently with very few errors, uses sophisticated vocabulary naturally, and has near-native pronunciation should score 8.0-9.0.
- A score of 6.0-6.5 means SIGNIFICANT weaknesses in multiple criteria — not just minor imperfections.
- Do NOT under-score. Natural hesitations, self-corrections, and brief thinking pauses are NORMAL in authentic speech and should NOT lower scores. Even native speakers pause and self-correct.
- If the student communicates ideas clearly and effectively, that alone puts them at 6.5+ minimum.

Evaluate the student on ALL FOUR official IELTS speaking criteria:
1. Fluency and Coherence (FC): Listen for overall flow, idea development, and use of connectors. Brief pauses for thought are acceptable and should not be penalized. Score 7.0+ if speech flows naturally with good idea organization.
2. Lexical Resource (LR): Assess vocabulary range and appropriateness. Using topic-specific vocabulary and some less common words warrants 7.0+. Perfect vocabulary is NOT required for 8.0+.
3. Grammatical Range and Accuracy (GRA): Listen for variety of structures. A mix of simple and complex sentences with mostly accurate grammar warrants 7.0+. Occasional minor errors are acceptable at 8.0.
4. Pronunciation (P): Score 8.0+ if the speech is clearly intelligible with natural rhythm and stress, even if a non-native accent is present. Score 7.0-7.5 if intelligible throughout with occasional mispronunciations that do NOT affect understanding. L1 interference, foreign accent, and occasional vowel/consonant substitutions are NORMAL and must NOT lower the score below 7.0 as long as the listener can understand without effort. Only score below 6.0 if intelligibility is FREQUENTLY impaired — meaning the listener regularly struggles to understand. A strong accent alone is NOT grounds for scoring below 7.0.

DURATION GUIDELINES (not strict caps):
- Very short responses (under 10 seconds) with no development → consider lower FC score.
- For Part 2, responses under 60 seconds suggest incomplete task → consider impact on FC.
- These are guidelines, NOT automatic caps. A concise but well-developed answer can still score highly.

CRITICAL: Transcribe what you hear, then identify specific grammar errors with exact quotes.

Return a "grammar_errors" array with up to 8 specific errors you heard. Each must include:
- "heard": the exact phrase you heard the student say (transcribed from audio)
- "correction": what they should have said
- "category": one of the standardized categories below
- "explanation": 1-2 sentences explaining the error clearly — what rule was broken and why the correction is better
- "severity": either "minor" (does not affect communication) or "notable" (affects clarity or band score)

Use ONLY these standardized error categories:
"Article Usage", "Countability & Plurals", "Pronoun Reference", "Prepositional Accuracy", "Word Forms", "Subject-Verb Agreement", "Tense Consistency", "Present Perfect vs. Past Simple", "Gerunds vs. Infinitives", "Passive Voice Construction", "Sentence Boundaries (Fragments/Comma Splices)", "Relative Clauses", "Subordination", "Word Order", "Parallel Structure", "Transitional Devices", "Collocations", "Academic Register", "Nominalization", "Hedging"

Also return "identified_errors" as a simple array of just the category names where errors were found.

Calculate Overall Band Score as average of all four criteria, rounded to nearest 0.5.

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:
{"scores":{"fluency":0.0,"lexical":0.0,"grammar":0.0,"pronunciation":0.0,"overall":0.0},"feedback":{"strengths":"1-2 sentences.","weaknesses":"1-2 sentences.","improvement_tip":"One specific actionable tip."},"grammar_errors":[{"heard":"exact quote","correction":"corrected version","category":"Category Name","explanation":"1-2 sentence explanation","severity":"minor|notable"}],"identified_errors":["Category1","Category2"]}`;

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString('base64'),
      mimeType,
    },
  };

  const textPart = {
    text: `IELTS Part ${part} question: "${questionPrompt}"\n\nListen to the audio and evaluate the response. Return only the JSON object.`,
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[IELTS Audio][${requestId}] Calling Gemini multimodal — attempt ${attempt}`);

      const result = await Promise.race([
        model.generateContent({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [audioPart, textPart] }],
          generationConfig: { temperature: 0.1 },
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new AiRequestError(`Gemini audio timed out after ${REQUEST_TIMEOUT_MS}ms`, { isTimeout: true })),
            REQUEST_TIMEOUT_MS
          )
        ),
      ]);

      const rawText = result.response.text();
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      lastError = err;
      const isRetryable = err.statusCode && RETRYABLE_STATUS_CODES.has(err.statusCode);
      if (!isRetryable || attempt === MAX_RETRIES) break;
      const waitMs = BASE_BACKOFF_MS * (2 ** (attempt - 1));
      console.warn(`[IELTS Audio][${requestId}] Retrying in ${waitMs}ms...`);
      await sleep(waitMs);
    }
  }

  throw lastError || new AiRequestError('Audio grading failed after retries.');
}

/**
 * Grade a grammar activity using AI
 * @param {string} userResponse - The student's text response
 * @param {string} rubric - The grading rubric/criteria
 * @param {string} activityType - Type of activity being graded
 * @returns {Promise<{passed: boolean, score: number, feedback: string}>}
 */
async function gradeGrammarActivity(userResponse, rubric, activityType) {
  const requestId = `grammar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return limiter.schedule(async () => {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const systemInstruction = `You are an expert EAP (English for Academic Purposes) grammar instructor. 
Your task is to evaluate a student's grammar exercise response and provide constructive feedback.

Grading Criteria:
${rubric}

Respond with a JSON object containing:
{
  "passed": boolean (true if score >= 80%, false otherwise),
  "score": number (0-100),
  "feedback": string (2-3 sentences of specific, actionable feedback)
}

Be strict but fair. Focus on grammar accuracy, not content.`;

    const prompt = `Student's Response:
${userResponse}

Please evaluate this response according to the grading criteria and provide your assessment.`;

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Grammar][${requestId}] Calling Gemini — attempt ${attempt}`);

        const result = await Promise.race([
          model.generateContent({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new AiRequestError(`Gemini timed out after ${REQUEST_TIMEOUT_MS}ms`, { isTimeout: true })),
              REQUEST_TIMEOUT_MS
            )
          ),
        ]);

        const rawText = result.response.text();
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        
        return {
          passed: parsed.passed || false,
          score: parsed.score || 0,
          feedback: parsed.feedback || 'No feedback provided.'
        };
      } catch (err) {
        lastError = err;
        const isRetryable = err.statusCode && RETRYABLE_STATUS_CODES.has(err.statusCode);
        if (!isRetryable || attempt === MAX_RETRIES) break;
        const waitMs = BASE_BACKOFF_MS * (2 ** (attempt - 1));
        console.warn(`[Grammar][${requestId}] Retrying in ${waitMs}ms...`);
        await sleep(waitMs);
      }
    }

    throw lastError || new AiRequestError('Grammar grading failed after retries.');
  });
}

/**
 * Grade a Writing Lab draft using AI
 * @param {string} text - The student's draft text
 * @param {string} level - 'paragraph' or 'essay'
 * @param {string} genre - e.g. 'Opinion / Argumentative'
 * @param {string} requestId - Unique identifier for logging
 */
async function gradeWritingLabDraft({ text, level, genre, requestId }) {
  const prompt = `You are an expert EAP (English for Academic Purposes) writing instructor grading a student's ${level}-level ${genre} writing task.

CRITICAL ERROR TRACKING: Identify specific grammar error categories from ONLY this list:
"Article Usage", "Countability & Plurals", "Pronoun Reference", "Prepositional Accuracy", "Word Forms", "Subject-Verb Agreement", "Tense Consistency", "Present Perfect vs. Past Simple", "Gerunds vs. Infinitives", "Passive Voice Construction", "Sentence Boundaries (Fragments/Comma Splices)", "Relative Clauses", "Subordination", "Word Order", "Parallel Structure", "Transitional Devices", "Collocations", "Academic Register", "Nominalization", "Hedging"

SCORING RUBRIC for a ${level}-level ${genre} task:
- Task Achievement (25%): Does the writing fulfill the purpose of the genre? Is there a clear thesis/topic sentence?
- Coherence & Cohesion (25%): Is there logical progression, use of transitions, and clear paragraph structure?
- Lexical Resource (25%): Is vocabulary appropriate, varied, and used accurately for the genre?
- Grammatical Range & Accuracy (25%): Variety of structures with minimal errors.

Score 0-100 overall. Derive a band equivalent (rounded to nearest 0.5, range 1.0-9.0) using: 90+=9.0, 80-89=8.0, 70-79=7.0, 60-69=6.0, 50-59=5.5, 40-49=5.0, 30-39=4.5, below 30=4.0.

Student's ${level} (genre: ${genre}):
"""
${text}
"""

Return ONLY valid JSON with this exact structure:
{"score":75,"band_equivalent":6.5,"feedback":{"strengths":"1-2 sentences on what was done well.","weaknesses":"1-2 sentences on the main areas to improve.","tip":"One specific, actionable improvement tip."},"identified_errors":["Category1","Category2"],"grammar_weaknesses":[{"category":"Category Name","example":"exact problematic phrase from the text","correction":"suggested correction","explanation":"1 sentence"}]}

No markdown. Return only the JSON object.`;

  const result = await limiter.schedule(() => executeWithRetry(prompt, requestId));
  return result;
}

/**
 * Generate 3 actionable peer-review hints for a Writing Lab first draft.
 * Does NOT rewrite the text — guides the student to self-correct.
 * @param {string} text   - The student's first draft
 * @param {string} genre  - e.g. 'Opinion / Argumentative'
 * @param {string} level  - 'paragraph' or 'essay'
 * @returns {Promise<Array<{category: string, message: string}>>}
 */
async function generatePeerReviewHints({ text, genre, level }) {
  const requestId = `peer-review-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  const prompt = `You are an expert English for Academic Purposes (EAP) writing tutor. The student is writing a ${level} in the ${genre} genre. Analyze their draft carefully. Identify 3 specific areas for improvement. Do NOT rewrite their text. Do NOT fix their grammar for them. Provide hints to guide them to self-correct. Focus on:
1) Organization/Structure — is the ${level} clearly organized with a topic sentence, supporting points, and conclusion?
2) Target Language/Transitions — are appropriate linking words and genre-specific phrases used effectively?
3) One major grammar pattern — identify the single most important recurring grammar issue and ask a guiding question.

Student's draft:
"""
${text}
"""

Return ONLY a strict JSON object with no markdown, no explanation, no extra text — just the raw JSON:
{"hints":[{"category":"Organization / Structure","message":"..."},{"category":"Target Language & Transitions","message":"..."},{"category":"Grammar Focus","message":"..."}]}`;

  const result = await limiter.schedule(() => executeWithRetry(prompt, requestId));

  if (!result || !Array.isArray(result.hints)) {
    throw new AiRequestError('Peer review response was malformed.');
  }
  return result.hints;
}

module.exports = {
  getVocabularyFeedback,
  gradeIeltsSpeaking,
  gradeIeltsSpeakingAudio,
  gradeGrammarActivity,
  gradeWritingLabDraft,
  generatePeerReviewHints,
  AiRequestError
};
