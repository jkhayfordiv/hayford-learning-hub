import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PenTool, GitBranch, Mic, Plus, Star, BookOpen, Trophy,
  BarChart3, Loader2, X, CheckCircle, AlertCircle, ArrowLeft,
  Sparkles, Zap, ChevronRight, FlaskConical, User, LogOut,
  Search, RotateCcw, Trash2,
} from 'lucide-react';
import logo from '../../assets/logo.png';
import StudySession from './StudySession';
import FlashcardSandbox from './FlashcardSandbox';
import VocabQuizModal from './VocabQuizModal';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

// ─── SRS level label helper ─────────────────────────────────────────────────
function srsLabel(level) {
  if (level === 0) return { label: 'New', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
  if (level <= 2)  return { label: 'Learning', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
  if (level <= 4)  return { label: 'Reviewing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  return             { label: 'Mastered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border font-semibold text-sm animate-in slide-in-from-bottom-4 ${
      isSuccess
        ? 'bg-emerald-50 dark:bg-emerald-900/80 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
        : 'bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
    }`}>
      {isSuccess ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100"><X size={16} /></button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VocabLabDashboard() {
  const navigate = useNavigate();

  // Branding
  let branding = {};
  try { branding = JSON.parse(localStorage.getItem('branding') || '{}'); } catch (_) {}
  const brandPrimary  = branding.primary_color || '#800020';
  const brandDark = (() => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(brandPrimary);
    if (!r) return '#1a0008';
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(v=>Math.round(v*0.6).toString(16).padStart(2,'0')).join('')}`;
  })();
  const brandLogoUrl = branding.logo_url || null;
  const brandWelcome = branding.welcome_text || 'Hayford Hub';

  let currentUser = {};
  try { currentUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch (_) {}

  // ── State ──────────────────────────────────────────────────────────────────
  const [dueToday,     setDueToday]     = useState([]);
  const [starredWords, setStarredWords] = useState([]);
  const [stats,        setStats]        = useState({ total_mastered: 0, total_learning: 0, total_words: 0 });
  const [isLoading,    setIsLoading]    = useState(true);
  const [toast,        setToast]        = useState(null);
  const [isStudying,   setIsStudying]   = useState(false);
  const [isMasteredReview, setIsMasteredReview] = useState(false);
  const [masteredWords, setMasteredWords] = useState([]);

  // Add Word modal
  const [isAddModalOpen,    setIsAddModalOpen]    = useState(false);
  const [addWordInput,      setAddWordInput]      = useState('');
  const [addWordLoading,    setAddWordLoading]    = useState(false);
  const [addWordError,      setAddWordError]      = useState('');

  // Disambiguation modal (206 response)
  const [disambigOptions, setDisambigOptions] = useState(null);
  const [disambigLoading, setDisambigLoading] = useState(false);

  // Sandbox / all-words
  const [allWords,        setAllWords]        = useState([]);
  const [sandboxWords,    setSandboxWords]    = useState([]);
  const [isSandboxMode,   setIsSandboxMode]   = useState(false);
  const [isFamilyMode,    setIsFamilyMode]    = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [isQuizOpen,    setIsQuizOpen]    = useState(false);

  // ── Quiz cooldown (1 hour) ─────────────────────────────────────────────────
  const COOLDOWN_KEY = 'vocab_quiz_cooldown';
  const COOLDOWN_MS  = 60 * 60 * 1000;
  const getQuizCooldownRemaining = () => {
    const ts = localStorage.getItem(COOLDOWN_KEY);
    if (!ts) return 0;
    const elapsed = Date.now() - parseInt(ts, 10);
    return Math.max(0, COOLDOWN_MS - elapsed);
  };
  const [cooldownMs, setCooldownMs] = useState(getQuizCooldownRemaining);

  useEffect(() => {
    if (cooldownMs <= 0) return;
    const interval = setInterval(() => {
      const remaining = getQuizCooldownRemaining();
      setCooldownMs(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 10000);
    return () => clearInterval(interval);
  }, [cooldownMs]);

  const formatCooldown = (ms) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m` : `${secs}s`;
  };

  const handleGenerateQuiz = () => {
    const starredCount = allWords.filter(w => w.is_starred).length;
    if (starredCount < 5) {
      showToast('error', 'You need at least 5 starred words to generate a quiz.');
      return;
    }
    if (cooldownMs > 0) return;
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    setCooldownMs(COOLDOWN_MS);
    setIsQuizOpen(true);
  };

  // My Lists modal + Word Family overlay
  const [listModal,       setListModal]       = useState(null); // { title, words }
  const [wordFamilyWord,  setWordFamilyWord]  = useState(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/dashboard`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load dashboard');
      const data = await res.json();
      setDueToday(data.due_today || []);
      setStarredWords(data.starred_words || []);
      setAllWords(data.all_words || []);
      setMasteredWords(data.mastered_words || []);
      setStats(data.stats || { total_mastered: 0, total_learning: 0, total_words: 0 });
    } catch (err) {
      showToast('error', err.message || 'Could not load Vocab Lab data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Add Word ───────────────────────────────────────────────────────────────
  const handleAddWord = async (e) => {
    e?.preventDefault();
    if (!addWordInput.trim()) return;
    setAddWordLoading(true);
    setAddWordError('');

    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/add`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ word: addWordInput.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (res.status === 201) {
        setAddWordInput('');
        showToast('success', `"${data.global_word?.word}" added to your Vocab Lab!`);
        fetchDashboard();
      } else if (res.status === 206) {
        // Disambiguation needed
        setDisambigOptions(data.options);
      } else if (res.status === 200 && data.duplicate) {
        showToast('success', data.message);
        setAddWordInput('');
      } else if (res.status === 404) {
        setAddWordError(data.error || 'Word not found in the dictionary');
      } else {
        setAddWordError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setAddWordError('Network error — please try again');
    } finally {
      setAddWordLoading(false);
    }
  };

  const handleSelectSense = async (sense_id, wordLabel) => {
    setDisambigLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/add`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sense_id }),
      });
      const data = await res.json();

      if (res.status === 201 || (res.status === 200 && data.duplicate)) {
        setDisambigOptions(null);
        setAddWordInput('');
        showToast('success', data.duplicate ? data.message : `"${wordLabel}" added to your Vocab Lab!`);
        if (!data.duplicate) fetchDashboard();
      } else {
        showToast('error', data.error || 'Failed to add word');
      }
    } catch (_) {
      showToast('error', 'Network error — please try again');
    } finally {
      setDisambigLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('branding');
    window.location.href = '/login';
  };

  // ── Word remove / reset ──────────────────────────────────────────
  const handleResetWord = async (userWordId) => {
    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/words/${userWordId}/reset`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const update = w => w.user_word_id === userWordId ? { ...w, srs_level: data.srs_level } : w;
      setAllWords(prev => prev.map(update));
      setListModal(prev => prev ? { ...prev, words: prev.words.map(update) } : null);
    } catch (_) { showToast('error', 'Could not reset word'); }
  };

  const handleDeleteWord = async (userWordId) => {
    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/words/${userWordId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const remove = arr => arr.filter(w => w.user_word_id !== userWordId);
      setAllWords(prev => remove(prev));
      setListModal(prev => prev ? { ...prev, words: remove(prev.words) } : null);
      if (wordFamilyWord?.user_word_id === userWordId) setWordFamilyWord(null);
      fetchDashboard();
    } catch (_) { showToast('error', 'Could not delete word'); }
  };

  // ── Star toggle ──────────────────────────────────────────────────
  const handleToggleStar = async (userWordId) => {
    try {
      const res = await fetch(`${API_BASE}/api/vocab-lab/words/${userWordId}/star`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAllWords(prev => prev.map(w =>
        w.user_word_id === userWordId ? { ...w, is_starred: data.is_starred } : w
      ));
      setListModal(prev => prev ? {
        ...prev,
        words: prev.words.map(w =>
          w.user_word_id === userWordId ? { ...w, is_starred: data.is_starred } : w
        ),
      } : null);
    } catch (_) {
      showToast('error', 'Could not update star');
    }
  };

  // ── Practice tile config ─────────────────────────────────────────────
  const practiceTiles = [
    {
      id: 'flashcard',
      icon: BookOpen,
      title: 'Flashcards',
      desc: 'Fill-in-the-blank practice',
      color: 'from-indigo-600 to-violet-700',
      onClick: () => setIsSandboxOpen(true),
    },
    {
      id: 'sentence',
      icon: PenTool,
      title: 'Sentence Builder',
      desc: 'Use words in context',
      color: 'from-violet-600 to-purple-700',
      onClick: () => {
        const learningWords = allWords.filter(w => w.srs_level < 5);
        if (learningWords.length === 0) {
          showToast('error', 'No learning words yet — add some words first!');
          return;
        }
        navigate('/sentence-builder', { state: { words: learningWords } });
      },
    },
    {
      id: 'speak',
      icon: Mic,
      title: 'Speak It',
      desc: 'Pronunciation practice',
      color: 'from-rose-600 to-pink-700',
      onClick: () => {
        if (masteredWords.length === 0) { showToast('error', 'Master at least one word first — keep reviewing to level up!'); return; }
        setSandboxWords(masteredWords); setIsSandboxMode(false); setIsFamilyMode(false); setIsMasteredReview(true); setIsStudying(true);
      },
    },
    {
      id: 'families',
      icon: GitBranch,
      title: 'Word Families',
      desc: 'Explore related forms',
      color: 'from-sky-600 to-blue-700',
      onClick: () => {
        if (allWords.length === 0) { showToast('error', 'No words in your Vocab Lab yet — add some first!'); return; }
        setSandboxWords(allWords); setIsSandboxMode(true); setIsFamilyMode(true); setIsMasteredReview(false); setIsStudying(true);
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A1930] font-sans">

      {/* ── Header ── */}
      <header
        className="border-b border-black/10 px-8 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <img
            src={brandLogoUrl || logo}
            alt="Logo"
            onError={e => { e.target.onerror = null; e.target.src = logo; }}
            className="w-9 h-9 object-contain"
          />
          <div>
            <h1 className="font-bold text-white text-base leading-none">{brandWelcome}</h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-white/70 flex items-center gap-1">
              <FlaskConical size={10} /> Vocab Lab
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/20">
            <User size={13} className="text-white/70" />
            <span className="text-xs font-bold text-white">{currentUser.first_name || 'Student'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Page title ── */}
      <div className="max-w-7xl mx-auto px-8 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <FlaskConical size={28} className="text-slate-700 dark:text-white" />
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Vocab Lab</h2>
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm ml-10">
          Your AI-powered spaced repetition vocabulary engine
        </p>
      </div>

      {/* ── Main Grid ── */}
      <main className="max-w-7xl mx-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Loader2 size={40} className="animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Loading your Vocab Lab...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* ══════════════ LEFT COLUMN ══════════════ */}
            <div className="md:col-span-8 flex flex-col gap-6">

              {/* Add Word Search Bar */}
              <div className="space-y-1.5">
                <form onSubmit={handleAddWord} className="flex gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={addWordInput}
                      onChange={e => { setAddWordInput(e.target.value); setAddWordError(''); }}
                      placeholder="Search or add a word to your Vocab Lab..."
                      className="w-full pl-11 pr-5 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent shadow-sm transition-all"
                      style={{ '--tw-ring-color': brandPrimary }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addWordLoading || !addWordInput.trim()}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black text-white shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
                  >
                    {addWordLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Add
                  </button>
                </form>
                {addWordError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold px-1">
                    <AlertCircle size={13} /> {addWordError}
                  </p>
                )}
              </div>

              {/* Hero Card */}
              <div
                className="rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
              >
                {/* Decorative circles */}
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full bg-white/5" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap size={18} className="text-white/80" />
                    <span className="text-xs font-black uppercase tracking-widest text-white/70">Daily Review</span>
                  </div>

                  {dueToday.length === 0 ? (
                    <>
                      <h3 className="text-3xl font-black tracking-tight mb-2">
                        You're all caught up! 🎉
                      </h3>
                      <p className="text-white/70 text-sm mb-6">
                        No words are due right now. Add more words to your lab to keep building.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-3xl font-black tracking-tight mb-2">
                        {dueToday.length} word{dueToday.length !== 1 ? 's' : ''} due for review today
                      </h3>
                      <p className="text-white/70 text-sm mb-6">
                        Keep your SRS streak going — the more consistently you review, the faster you'll master these words.
                      </p>
                    </>
                  )}

                  <button
                    onClick={() => { if (dueToday.length > 0) setIsStudying(true); }}
                    disabled={dueToday.length === 0}
                    className="inline-flex items-center gap-3 bg-white text-slate-900 font-black px-8 py-4 rounded-2xl text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    <Sparkles size={20} />
                    Start Daily Review
                    {dueToday.length > 0 && (
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full text-white"
                        style={{ background: brandPrimary }}
                      >
                        {dueToday.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* 2×2 Practice Tiles */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Practice Modes</h4>
                <div className="grid grid-cols-2 gap-4">
                  {practiceTiles.map(tile => (
                    <button
                      key={tile.id}
                      onClick={tile.onClick}
                      className={`bg-gradient-to-br ${tile.color} rounded-3xl p-6 text-white text-left shadow-md hover:shadow-xl hover:scale-105 transition-all group`}
                    >
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
                        <tile.icon size={22} />
                      </div>
                      <h3 className="font-black text-base tracking-tight leading-tight">{tile.title}</h3>
                      <p className="text-[11px] text-white/70 mt-1">{tile.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ══════════════ RIGHT COLUMN ══════════════ */}
            <div className="md:col-span-4 flex flex-col gap-6">

              {/* My Lists */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5">My Lists</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => setListModal({ title: 'Mastered Words', words: masteredWords })}
                    className="w-full flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all group text-left"
                  >
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Trophy size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{stats.total_mastered}</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">Mastered Words</p>
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </span>
                  </button>
                  <button
                    onClick={() => setListModal({ title: 'Words Learning', words: allWords.filter(w => w.srs_level < 5 || w.is_starred) })}
                    className="w-full flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all group text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{stats.total_learning}</p>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wide">Words Learning</p>
                    </div>
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </span>
                  </button>
                  <button
                    onClick={() => setListModal({ title: 'All Words in Lab', words: allWords })}
                    className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group text-left"
                  >
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BookOpen size={20} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-black text-slate-700 dark:text-white">{stats.total_words}</p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total in Lab</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </span>
                  </button>
                </div>
              </div>

              {/* Starred Words */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex-1">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Starred Words</h4>
                  <Star size={15} className="text-amber-400" />
                </div>
                {allWords.filter(w => w.is_starred).length === 0 ? (
                  <div className="text-center py-8">
                    <Star size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No starred words yet</p>
                    <p className="text-xs text-slate-400 mt-1">Star words from My Lists to save them here</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {allWords.filter(w => w.is_starred).map(w => (
                      <div
                        key={w.user_word_id}
                        className="flex items-center gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700"
                      >
                        <button
                          onClick={() => setWordFamilyWord(w)}
                          className="flex-1 text-left hover:opacity-80 transition-opacity"
                        >
                          <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">{w.word}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{w.part_of_speech}</p>
                        </button>
                        <button
                          onClick={() => handleToggleStar(w.user_word_id)}
                          title="Unstar"
                          className="w-7 h-7 flex items-center justify-center rounded-full text-amber-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex-shrink-0"
                        >
                          <Star size={14} className="fill-amber-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Generate AI Quiz button */}
                {(() => {
                  const onCooldown = cooldownMs > 0;
                  const starredCount = allWords.filter(w => w.is_starred).length;
                  const notEnough = starredCount < 5;
                  const disabled = onCooldown || notEnough;
                  return (
                    <button
                      onClick={handleGenerateQuiz}
                      disabled={disabled}
                      className={`mt-4 w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-black text-sm transition-all ${
                        disabled
                          ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95'
                      }`}
                      style={disabled ? {} : { background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
                      title={
                        onCooldown ? `Available in ${formatCooldown(cooldownMs)}`
                          : notEnough ? 'Star at least 5 words to unlock'
                          : 'Generate a 5-question quiz from your starred words'
                      }
                    >
                      <Sparkles size={15} />
                      {onCooldown
                        ? `Available in ${formatCooldown(cooldownMs)}`
                        : notEnough
                        ? `Star ${5 - starredCount} more word${5 - starredCount !== 1 ? 's' : ''} to unlock quiz`
                        : 'Generate AI Quiz'}
                    </button>
                  );
                })()}
              </div>

            </div>
          </div>
        )}
      </main>


      {/* ══════════════ VOCAB QUIZ MODAL ══════════════ */}
      {isQuizOpen && (
        <VocabQuizModal
          brandPrimary={brandPrimary}
          brandDark={brandDark}
          onClose={() => setIsQuizOpen(false)}
        />
      )}

      {/* ══════════════ DISAMBIGUATION MODAL ══════════════ */}
      {disambigOptions && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDisambigOptions(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-black text-xl text-white">Which meaning?</h3>
                  <p className="text-xs text-white/70 mt-1">This word has multiple senses — choose the one you want to learn</p>
                </div>
                <button
                  onClick={() => setDisambigOptions(null)}
                  className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors mt-0.5"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {disambigOptions.map(opt => (
                <button
                  key={opt.sense_id}
                  onClick={() => handleSelectSense(opt.sense_id, opt.word)}
                  disabled={disambigLoading}
                  className="w-full text-left p-5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-2xl transition-all group disabled:opacity-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-base text-slate-900 dark:text-white capitalize">{opt.word}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full uppercase tracking-wide">
                          {opt.part_of_speech}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{opt.primary_definition}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-2">{opt.sense_id}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setDisambigOptions(null)}
                className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MY LISTS MODAL ══════════════ */}
      {listModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setListModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="px-8 py-6 flex items-center justify-between flex-shrink-0"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
            >
              <div>
                <h3 className="font-black text-xl text-white">{listModal.title}</h3>
                <p className="text-xs text-white/70 mt-0.5">{listModal.words.length} word{listModal.words.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setListModal(null)} className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {listModal.words.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen size={36} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">No words in this category yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {listModal.words.map(w => {
                    const badge = srsLabel(w.srs_level);
                    return (
                      <div key={w.user_word_id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">{w.word}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>{badge.label}</span>
                          </div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{w.part_of_speech}</p>
                        </div>
                        <button
                          onClick={() => handleToggleStar(w.user_word_id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                            w.is_starred
                              ? 'text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                              : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                          }`}
                          title={w.is_starred ? 'Unstar' : 'Star'}
                        >
                          <Star size={13} className={w.is_starred ? 'fill-amber-400' : ''} />
                        </button>
                        <button
                          onClick={() => handleResetWord(w.user_word_id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex-shrink-0"
                          title="Reset to New"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteWord(w.user_word_id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                          title="Remove from vocab"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setListModal(null)}
                className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ WORD FAMILY OVERLAY ══════════════ */}
      {wordFamilyWord && (() => {
        const wf = typeof wordFamilyWord.word_family === 'string'
          ? JSON.parse(wordFamilyWord.word_family || '{}')
          : (wordFamilyWord.word_family || {});
        const entries = Object.entries(wf).filter(([, v]) => v && typeof v === 'string' && v.trim() && v.toLowerCase() !== wordFamilyWord.word.toLowerCase());
        return (
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setWordFamilyWord(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div
                className="p-6 flex items-start justify-between flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandDark})` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{wordFamilyWord.part_of_speech}</p>
                  <h3 className="text-3xl font-black text-white capitalize mb-2 leading-tight">{wordFamilyWord.word}</h3>
                  <p className="text-sm text-white/80 leading-relaxed">{wordFamilyWord.primary_definition}</p>
                </div>
                <button onClick={() => setWordFamilyWord(null)} className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors ml-4 flex-shrink-0 mt-1">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {entries.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Word Family</p>
                    <div className="grid grid-cols-2 gap-3">
                      {entries.map(([pos, form]) => (
                        <div key={pos} className="px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">{pos}</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{form}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No word family data available</p>
                )}

                {wordFamilyWord.context_sentence && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Example</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{wordFamilyWord.context_sentence}"</p>
                  </div>
                )}
              </div>

              <div className="px-6 pb-5 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                {wordFamilyWord.is_starred && (
                  <button
                    onClick={() => { handleToggleStar(wordFamilyWord.user_word_id); setWordFamilyWord(prev => ({ ...prev, is_starred: false })); }}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm text-amber-600 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Star size={14} className="fill-amber-500" /> Unstar
                  </button>
                )}
                <button
                  onClick={() => setWordFamilyWord(null)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════ FLASHCARD SANDBOX ══════════════ */}
      {isSandboxOpen && (
        <FlashcardSandbox
          words={allWords}
          brandPrimary={brandPrimary}
          brandDark={brandDark}
          onClose={() => setIsSandboxOpen(false)}
        />
      )}

      {/* ══════════════ STUDY SESSION ══════════════ */}
      {isStudying && (
        <StudySession
          words={isMasteredReview ? masteredWords : (isSandboxMode || isFamilyMode ? sandboxWords : dueToday)}
          isMasteredReview={isMasteredReview}
          isSandboxMode={isSandboxMode}
          isFamilyMode={isFamilyMode}
          brandPrimary={brandPrimary}
          brandDark={brandDark}
          onClose={() => { setIsStudying(false); setIsMasteredReview(false); setIsSandboxMode(false); setIsFamilyMode(false); }}
          onComplete={() => { setIsStudying(false); setIsMasteredReview(false); setIsSandboxMode(false); setIsFamilyMode(false); fetchDashboard(); }}
        />
      )}

      {/* ══════════════ TOAST ══════════════ */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
