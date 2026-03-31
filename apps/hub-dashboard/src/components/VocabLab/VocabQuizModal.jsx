import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, ChevronRight, Trophy, Loader2, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

export default function VocabQuizModal({ brandPrimary, brandDark, onClose }) {
  const [status,        setStatus]        = useState('loading'); // 'loading' | 'quiz' | 'error' | 'complete'
  const [questions,     setQuestions]     = useState([]);
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [selected,      setSelected]      = useState(null);   // the option string the user clicked
  const [score,         setScore]         = useState(0);
  const [errorMsg,      setErrorMsg]      = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/vocab-lab/generate-quiz`, {
          method: 'POST',
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to generate quiz.');
          setStatus('error');
          return;
        }
        setQuestions(data.quiz || []);
        setStatus('quiz');
      } catch (_) {
        setErrorMsg('Network error. Please check your connection and try again.');
        setStatus('error');
      }
    })();
  }, []);

  const currentQ = questions[currentIdx] ?? null;
  const isAnswered = selected !== null;
  const isLastQuestion = currentIdx === questions.length - 1;

  const handleSelect = (option) => {
    if (isAnswered) return;
    setSelected(option);
    if (option === currentQ.correct_answer) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setStatus('complete');
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
    }
  };

  const optionClass = (option) => {
    if (!isAnswered) {
      return 'border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white hover:border-slate-400 dark:hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer';
    }
    if (option === currentQ.correct_answer) {
      return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 cursor-default';
    }
    if (option === selected) {
      return 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 cursor-default';
    }
    return 'border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 cursor-default opacity-60';
  };

  const scoreEmoji = () => {
    const pct = score / questions.length;
    if (pct === 1) return '🏆';
    if (pct >= 0.8) return '🎉';
    if (pct >= 0.6) return '👍';
    return '💪';
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={status === 'loading' ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="px-7 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-white text-lg leading-none">AI Vocab Quiz</h3>
              {status === 'quiz' && (
                <p className="text-[11px] text-white/60 mt-0.5">Question {currentIdx + 1} of {questions.length}</p>
              )}
            </div>
          </div>
          {status !== 'loading' && (
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Loading ── */}
        {status === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
            <div className="relative">
              <Loader2 size={44} className="animate-spin" style={{ color: brandPrimary }} />
              <Sparkles size={18} className="absolute -top-1 -right-1 text-amber-400" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white text-lg">Generating your quiz…</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                Our AI is crafting 5 custom questions from your starred words.<br />
                This usually takes <strong>15–20 seconds</strong>.
              </p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
            <XCircle size={44} className="text-red-400" />
            <p className="font-black text-slate-900 dark:text-white text-lg">Quiz Generation Failed</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{errorMsg}</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-3 rounded-2xl font-bold text-sm border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* ── Quiz ── */}
        {status === 'quiz' && currentQ && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Progress bar */}
            <div className="h-1 bg-slate-100 dark:bg-slate-700 flex-shrink-0">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{ width: `${((currentIdx + (isAnswered ? 1 : 0)) / questions.length) * 100}%`, background: brandPrimary }}
              />
            </div>

            <div className="p-7 flex flex-col gap-5 flex-1">
              {/* Question */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Fill in the blank</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                  {currentQ.question}
                </p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2.5">
                {currentQ.options.map((option, i) => {
                  const isCorrect = isAnswered && option === currentQ.correct_answer;
                  const isWrong   = isAnswered && option === selected && option !== currentQ.correct_answer;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(option)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left font-semibold text-sm transition-all ${optionClass(option)}`}
                    >
                      <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0 text-xs font-black">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {isCorrect && <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />}
                      {isWrong   && <XCircle    size={18} className="text-red-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {isAnswered && (
                <div className={`rounded-2xl p-4 border ${
                  selected === currentQ.correct_answer
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                    selected === currentQ.correct_answer ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  }`}>
                    {selected === currentQ.correct_answer ? '✓ Correct!' : '✗ Not quite'}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{currentQ.explanation}</p>
                </div>
              )}
            </div>

            {/* Next button */}
            {isAnswered && (
              <div className="px-7 pb-6 pt-2 flex-shrink-0">
                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-white text-sm transition-all hover:opacity-90 active:scale-95"
                  style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
                >
                  {isLastQuestion ? 'See My Score' : 'Next Question'}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Complete ── */}
        {status === 'complete' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
            <div className="text-6xl">{scoreEmoji()}</div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Quiz Complete</p>
              <p className="text-5xl font-black" style={{ color: brandPrimary }}>{score}/{questions.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                {score === questions.length
                  ? 'Perfect score! Your vocabulary is excellent.'
                  : score >= 4
                  ? 'Great job! Keep reviewing your starred words.'
                  : score >= 3
                  ? 'Good effort! A bit more practice will help.'
                  : 'Keep studying — you\'re making progress!'}
              </p>
            </div>

            {/* Score breakdown bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(score / questions.length) * 100}%`, background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
              />
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl font-black text-white text-sm hover:opacity-90 active:scale-95 transition-all"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
            >
              <Trophy size={16} className="inline mr-2" />
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
