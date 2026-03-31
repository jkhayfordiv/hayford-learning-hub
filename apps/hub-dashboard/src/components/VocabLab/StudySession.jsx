import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, CheckCircle, XCircle, Loader2, ArrowRight, ChevronRight,
  AlertCircle, Sparkles, BookOpen, RotateCcw, Brain, Mic, Plus,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

// ─── Utilities ────────────────────────────────────────────────────────────────
function blankSentence(sentence, word) {
  if (!sentence || !word) return sentence || '';
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.replace(new RegExp(escaped, 'gi'), '______');
}

function getMode(srsLevel) {
  if (srsLevel >= 5) return 'speak';
  if (srsLevel <= 2) return 'flashcard';
  return 'sentence';
}

// Level 0-3: show hints. Level 4+: blind production (word + POS only)
function shouldShowHints(srsLevel) {
  return srsLevel <= 3;
}

// ─── Session Complete Screen ──────────────────────────────────────────────────
function SessionComplete({ results, onComplete, brandPrimary, brandDark }) {
  const correct = results.filter(r => r.is_correct).length;
  const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
  const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div
          className="p-8 text-center text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
        >
          <div className="text-5xl mb-3">{emoji}</div>
          <h2 className="text-3xl font-black tracking-tight">Session Complete!</h2>
          <p className="text-white/70 mt-1 text-sm font-medium">
            {correct} / {results.length} correct &nbsp;·&nbsp; {pct}% accuracy
          </p>
          <div className="mt-4 w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 bg-white rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto flex-1 p-6 space-y-2.5">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 p-4 rounded-2xl border ${
                r.is_correct
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
            >
              {r.is_correct
                ? <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                : <XCircle    size={20} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <span className="font-black text-slate-900 dark:text-white capitalize">{r.word}</span>
                {r.sentence && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic truncate">
                    "{r.sentence}"
                  </p>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
                {r.mode === 'flashcard' ? 'Fill-in' : 'Sentence'}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex-shrink-0 space-y-3">
          <button
            onClick={onComplete}
            className="w-full py-4 rounded-2xl font-black text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base"
            style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
          >
            <BookOpen size={20} /> Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main StudySession Component ──────────────────────────────────────────────
export default function StudySession({ words, onComplete, onClose, brandPrimary, brandDark, isMasteredReview = false, isSandboxMode = false, isFamilyMode = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('question');
  // phases: 'question' | 'correct' | 'wrong' | 'grading' | 'ai_feedback' | 'complete'

  const [inputValue,    setInputValue]    = useState('');
  const [confirmInput,  setConfirmInput]  = useState('');
  const [aiFeedback,    setAiFeedback]    = useState(null);
  const [inputError,    setInputError]    = useState('');
  const [results,       setResults]       = useState([]);
  const [isListening,      setIsListening]      = useState(false);
  const [speechError,      setSpeechError]      = useState('');
  const [quickAddMessage,  setQuickAddMessage]  = useState('');

  const mainInputRef    = useRef(null);
  const confirmInputRef = useRef(null);
  const recognitionRef  = useRef(null);

  const currentWord = words[currentIndex];
  const mode        = currentWord
    ? (isMasteredReview ? 'speak' : isFamilyMode ? 'family' : getMode(currentWord.srs_level))
    : null;
  const showHints   = currentWord ? shouldShowHints(currentWord.srs_level) : true;
  const collocations = Array.isArray(currentWord?.collocations) ? currentWord.collocations : [];
  const blanked      = currentWord ? blankSentence(currentWord.context_sentence, currentWord.word) : '';

  const wordFamily = typeof currentWord?.word_family === 'string'
    ? JSON.parse(currentWord?.word_family || '{}')
    : (currentWord?.word_family || {});
  const wordFamilyEntries = Object.entries(wordFamily)
    .filter(([, v]) => v && typeof v === 'string' && v.trim()
      && v.toLowerCase() !== currentWord?.word?.toLowerCase());

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  });

  // ── Auto-focus ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'question' && mainInputRef.current) {
      setTimeout(() => mainInputRef.current?.focus(), 50);
    }
    if (phase === 'wrong' && confirmInputRef.current) {
      setTimeout(() => confirmInputRef.current?.focus(), 50);
    }
  }, [phase, currentIndex]);

  // ── Advance helper (stable via ref) ────────────────────────────────────────
  const advanceRef = useRef(null);
  advanceRef.current = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setSpeechError('');
    setInputValue('');
    setConfirmInput('');
    setAiFeedback(null);
    setInputError('');
    setQuickAddMessage('');
    const next = currentIndex + 1;
    if (next >= words.length) {
      if (isFamilyMode) { onComplete(); return; }
      setPhase('complete');
    } else {
      setCurrentIndex(next);
      setPhase('question');
    }
  };

  // ── Speech Recognition ─────────────────────────────────────────────────────
  const toggleListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSpeechError('Speech recognition not supported — try Chrome or Edge, or type below.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    setSpeechError('');
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = (e) => {
      setIsListening(false);
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setSpeechError('Could not understand — please try again or type below.');
      }
    };
    recognition.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join('');
      setInputValue(text);
      setInputError('');
      if (e.results[e.results.length - 1].isFinal) setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Stop recognition on unmount
  useEffect(() => () => recognitionRef.current?.stop(), []);

  // ── Auto-advance after correct flashcard ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'correct') return;
    const t = setTimeout(() => advanceRef.current(), 2000);
    return () => clearTimeout(t);
  }, [phase, currentIndex]);

  // ── Fire-and-forget SRS update (skipped in mastered review mode) ──────────
  const submitReview = useCallback((userWordId, isCorrect) => {
    if (isMasteredReview || isSandboxMode) return;
    fetch(`${API_BASE}/api/vocab-lab/review`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ user_word_id: userWordId, is_correct: isCorrect }),
    }).catch(() => {});
  }, [isMasteredReview, isSandboxMode]);

  // ── Word Family quick-add ──────────────────────────────────────────────────
  const handleQuickAdd = useCallback(async (wordForm) => {
    if (!wordForm || !wordForm.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/add`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ word: wordForm.trim() }),
      });
      const data = await res.json();
      if (res.status === 201) {
        setQuickAddMessage(`Added "${wordForm}" to your list!`);
      } else if (res.status === 200 && data.duplicate) {
        setQuickAddMessage(`"${wordForm}" is already in your list`);
      } else if (res.status === 206) {
        setQuickAddMessage(`Multiple senses — add "${wordForm}" from the search bar`);
      } else {
        setQuickAddMessage(data.error || `Could not add "${wordForm}"`);
      }
    } catch (_) {
      setQuickAddMessage('Network error — please try again');
    }
    setTimeout(() => setQuickAddMessage(''), 3000);
  }, []);

  // ── Mode A: Check typed answer ─────────────────────────────────────────────
  const handleFlashcardSubmit = (e) => {
    e?.preventDefault();
    const val    = inputValue.trim().toLowerCase();
    const target = currentWord.word.toLowerCase();
    if (!val) return;

    if (val === target) {
      submitReview(currentWord.user_word_id, true);
      setResults(r => [...r, { word: currentWord.word, is_correct: true, mode: 'flashcard' }]);
      setPhase('correct');
    } else {
      setPhase('wrong');
    }
  };

  // ── Mode A: Wrong confirmation ─────────────────────────────────────────────
  const handleWrongConfirm = (e) => {
    e?.preventDefault();
    if (confirmInput.trim().toLowerCase() !== currentWord.word.toLowerCase()) return;
    submitReview(currentWord.user_word_id, false);
    setResults(r => [...r, { word: currentWord.word, is_correct: false, mode: 'flashcard' }]);
    advanceRef.current();
  };

  // ── Mode B: AI grade sentence ──────────────────────────────────────────────
  const handleSentenceSubmit = async (e) => {
    e?.preventDefault();
    const sentence = inputValue.trim();
    if (!sentence) return;

    if (!sentence.toLowerCase().includes(currentWord.word.toLowerCase())) {
      setInputError(`Your sentence must contain the word "${currentWord.word}"`);
      return;
    }

    setInputError('');
    setPhase('grading');

    try {
      const res  = await fetch(`${API_BASE}/api/vocab-lab/grade`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ user_word_id: currentWord.user_word_id, sentence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Grading failed');

      submitReview(currentWord.user_word_id, data.is_correct);
      setResults(r => [...r, { word: currentWord.word, is_correct: data.is_correct, mode: 'sentence', sentence }]);
      setAiFeedback(data);
      setPhase('ai_feedback');
    } catch (err) {
      setInputError(err.message || 'Something went wrong — please try again');
      setPhase('question');
    }
  };

  // ── Complete screen ────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <SessionComplete
        results={results}
        onComplete={onComplete}
        brandPrimary={brandPrimary}
        brandDark={brandDark}
      />
    );
  }

  if (!currentWord) return null;

  const progressPct = (currentIndex / words.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* ── Progress Header ── */}
        <div
          className="px-8 pt-6 pb-5 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                {isMasteredReview
                  ? '⭐  Mastered Words Review'
                  : isFamilyMode
                  ? '🌳  Word Families'
                  : mode === 'flashcard' ? '✍️  Fill in the Blank' : '💬  Sentence Builder'
                }
              </span>
              <span className="text-[10px] text-white/40">·</span>
              <span className="text-[10px] font-bold text-white/60">
                Level {currentWord.srs_level}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/80">
                {currentIndex + 1} / {words.length}
              </span>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                title="Exit session"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="overflow-y-auto flex-1 px-8 py-7 space-y-6">

          {/* ════ MODE A: FLASHCARD ════ */}

          {mode === 'flashcard' && phase === 'question' && (
            <>
              {/* Blanked sentence */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Complete the sentence
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {blanked.split('______').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block border-b-2 border-slate-400 dark:border-slate-500 min-w-[80px] mx-1 text-center text-slate-400 text-sm italic">
                          ______
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
              </div>

              {/* Definition hint */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <Brain size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-500 mb-0.5">Definition</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{currentWord.primary_definition}</p>
                  </div>
                </div>

                {collocations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Collocations</p>
                    <div className="flex flex-wrap gap-2">
                      {collocations.slice(0, 4).map((c, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleFlashcardSubmit}>
                <input
                  ref={mainInputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={`Type the missing word...`}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-3.5 text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-400 transition-colors"
                />
              </form>
            </>
          )}

          {mode === 'flashcard' && phase === 'correct' && (
            <div className="flex flex-col items-center py-10 gap-5 text-center">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                <CheckCircle size={44} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Correct!</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  The word was <span className="font-black text-emerald-600 dark:text-emerald-400 capitalize">{currentWord.word}</span>
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 w-full text-left">
                <p className="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                  "{currentWord.context_sentence}"
                </p>
              </div>
              <p className="text-xs text-slate-400">Advancing in 2 seconds...</p>
            </div>
          )}

          {mode === 'flashcard' && phase === 'wrong' && (
            <>
              <div className="flex items-start gap-4 p-5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                <XCircle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700 dark:text-red-400 mb-1">Not quite!</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    You typed: <span className="font-bold text-slate-800 dark:text-slate-200">"{inputValue}"</span>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    The answer is: <span className="font-black text-slate-900 dark:text-white capitalize">{currentWord.word}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                  "{currentWord.context_sentence}"
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Type the correct word to continue
                </p>
                <form onSubmit={handleWrongConfirm}>
                  <input
                    ref={confirmInputRef}
                    type="text"
                    value={confirmInput}
                    onChange={e => setConfirmInput(e.target.value)}
                    placeholder={`Type "${currentWord.word}" to continue`}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-3.5 text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-400 transition-colors"
                  />
                </form>
              </div>
            </>
          )}

          {/* ════ MODE B: SENTENCE BUILDER ════ */}

          {mode === 'sentence' && phase === 'question' && (
            <>
              {/* Word card */}
              <div
                className="rounded-2xl p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                  {currentWord.part_of_speech}
                </p>
                <h3 className="text-4xl font-black tracking-tight capitalize mb-3">{currentWord.word}</h3>
                {showHints && (
                  <p className="text-sm text-white/80 leading-relaxed">{currentWord.primary_definition}</p>
                )}
                {!showHints && (
                  <p className="text-xs text-white/40 italic">No hints — write from memory</p>
                )}
              </div>

              {/* Collocations — only shown when hints are enabled */}
              {showHints && collocations.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Common collocations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {collocations.map((c, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Blind mode badge */}
              {!showHints && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Blind production — use the word correctly from memory
                  </p>
                </div>
              )}

              {/* Word Family — quick-add related forms */}
              {wordFamilyEntries.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Word Family</p>
                  <div className="grid grid-cols-2 gap-2">
                    {wordFamilyEntries.map(([pos, form]) => (
                      <div key={pos} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400">{pos}</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{form}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(form)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-500 hover:text-emerald-600 transition-colors"
                          title={`Add "${form}" to your Vocab Lab`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {quickAddMessage && (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
                      <CheckCircle size={13} /> {quickAddMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Sentence input */}
              <form onSubmit={handleSentenceSubmit} className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Write an original sentence using this word
                </p>
                <textarea
                  ref={mainInputRef}
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setInputError(''); }}
                  placeholder={`e.g. "The committee will ${currentWord.word} the proposal next week."`}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-400 transition-colors resize-none"
                />
                {inputError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                    <AlertCircle size={13} /> {inputError}
                  </p>
                )}
              </form>
            </>
          )}

          {/* ════ MODE C: SPEAK IT ════ */}

          {mode === 'speak' && phase === 'question' && (
            <>
              {/* Blind word card */}
              <div
                className="rounded-2xl p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                  {currentWord.part_of_speech}
                </p>
                <h3 className="text-4xl font-black tracking-tight capitalize mb-3">{currentWord.word}</h3>
                <p className="text-xs text-white/40 italic">Speak a sentence from memory</p>
              </div>

              {/* Mic button */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative flex items-center justify-center">
                  {isListening && (
                    <span className="absolute inline-flex w-28 h-28 rounded-full bg-red-400/30 animate-ping" />
                  )}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl ${
                      isListening
                        ? 'bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-300 ring-offset-2 dark:ring-offset-slate-800'
                        : 'bg-rose-600 hover:bg-rose-700 hover:scale-105'
                    }`}
                  >
                    <Mic size={40} className="text-white" />
                  </button>
                </div>
                <p className={`text-sm font-bold transition-colors ${
                  isListening ? 'text-red-500 dark:text-red-400' : 'text-slate-400'
                }`}>
                  {isListening ? '🔴 Listening...' : 'Tap to speak'}
                </p>
                {speechError && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-700 text-center">
                    <AlertCircle size={13} className="flex-shrink-0" /> {speechError}
                  </p>
                )}
              </div>

              {/* Editable transcript */}
              <form onSubmit={handleSentenceSubmit} className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {inputValue ? 'Your sentence (edit if needed)' : 'Your sentence'}
                </p>
                <textarea
                  ref={mainInputRef}
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setInputError(''); }}
                  placeholder="Speak using the mic above, or type your sentence here..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-400 transition-colors resize-none"
                />
                {inputError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                    <AlertCircle size={13} /> {inputError}
                  </p>
                )}
              </form>
            </>
          )}

          {/* ════ MODE D: WORD FAMILIES ════ */}

          {mode === 'family' && phase === 'question' && (
            <>
              {/* Word card */}
              <div
                className="rounded-2xl p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                  {currentWord.part_of_speech}
                </p>
                <h3 className="text-4xl font-black tracking-tight capitalize mb-2">{currentWord.word}</h3>
                <p className="text-sm text-white/80 leading-relaxed">{currentWord.primary_definition}</p>
              </div>

              {/* Word Family Matrix */}
              {wordFamilyEntries.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Word Family</p>
                  <div className="grid grid-cols-2 gap-3">
                    {wordFamilyEntries.map(([pos, form]) => (
                      <div key={pos} className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">{pos}</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{form}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(form)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-500 hover:text-emerald-600 transition-colors flex-shrink-0"
                          title={`Add "${form}" to your Vocab Lab`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm font-medium text-slate-400">No word family data available</p>
                </div>
              )}

              {/* Context sentence */}
              {currentWord.context_sentence && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Example Sentence</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{currentWord.context_sentence}"</p>
                </div>
              )}

              {/* Quick-add confirmation */}
              {quickAddMessage && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle size={13} /> {quickAddMessage}
                </p>
              )}
            </>
          )}

          {(mode === 'sentence' || mode === 'speak') && phase === 'grading' && (
            <div className="flex flex-col items-center py-16 gap-4 text-center">
              <Loader2 size={44} className="animate-spin text-slate-400" />
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg">Evaluating your sentence...</p>
                <p className="text-sm text-slate-400 mt-1">Our AI tutor is checking your usage of "{currentWord.word}"</p>
              </div>
            </div>
          )}

          {(mode === 'sentence' || mode === 'speak') && phase === 'ai_feedback' && aiFeedback && (
            <>
              {/* Result card */}
              <div className={`rounded-2xl p-6 border-2 ${
                aiFeedback.is_correct
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {aiFeedback.is_correct
                    ? <CheckCircle size={24} className="text-emerald-600 dark:text-emerald-400" />
                    : <AlertCircle size={24} className="text-amber-600 dark:text-amber-400" />
                  }
                  <h4 className={`font-black text-lg ${
                    aiFeedback.is_correct
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    {aiFeedback.is_correct ? 'Excellent usage!' : 'Needs a little work'}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {aiFeedback.feedback_text}
                </p>
              </div>

              {/* Student's sentence */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Your sentence</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{inputValue}"</p>
              </div>

              {/* Grammar note (if word used correctly but grammar was off) */}
              {aiFeedback.is_correct && !aiFeedback.grammar_acceptable && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-blue-600 dark:text-blue-400">Grammar note: </span>
                    You used the word correctly! Keep working on the grammar around it.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div className="px-8 pb-6 pt-4 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">

          {phase === 'question' && mode === 'flashcard' && (
            <button
              onClick={handleFlashcardSubmit}
              disabled={!inputValue.trim()}
              className="w-full py-3.5 rounded-2xl font-black text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
            >
              Check Answer <ArrowRight size={18} />
            </button>
          )}

          {phase === 'question' && (mode === 'sentence' || mode === 'speak') && (
            <button
              onClick={handleSentenceSubmit}
              disabled={!inputValue.trim()}
              className="w-full py-3.5 rounded-2xl font-black text-white transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
            >
              <Sparkles size={18} /> Check with AI
            </button>
          )}

          {phase === 'wrong' && (
            <button
              onClick={handleWrongConfirm}
              disabled={confirmInput.trim().toLowerCase() !== currentWord.word.toLowerCase()}
              className="w-full py-3.5 rounded-2xl font-black text-white bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={18} />
            </button>
          )}

          {phase === 'ai_feedback' && (
            <button
              onClick={() => advanceRef.current()}
              className="w-full py-3.5 rounded-2xl font-black text-white transition-all hover:opacity-90 hover:shadow-lg flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
            >
              Next Word <ChevronRight size={18} />
            </button>
          )}

          {mode === 'family' && phase === 'question' && (
            <button
              onClick={() => advanceRef.current()}
              className="w-full py-3.5 rounded-2xl font-black text-white transition-all hover:opacity-90 hover:shadow-lg flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
            >
              Got it <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
