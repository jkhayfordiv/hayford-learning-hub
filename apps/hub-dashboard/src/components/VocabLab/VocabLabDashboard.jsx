import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PenTool, GitBranch, Mic, Plus, Star, BookOpen, Trophy,
  BarChart3, Loader2, X, CheckCircle, AlertCircle, ArrowLeft,
  Sparkles, Zap, ChevronRight, FlaskConical, User, LogOut,
} from 'lucide-react';
import logo from '../../assets/logo.png';

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

  // Add Word modal
  const [isAddModalOpen,    setIsAddModalOpen]    = useState(false);
  const [addWordInput,      setAddWordInput]      = useState('');
  const [addWordLoading,    setAddWordLoading]    = useState(false);
  const [addWordError,      setAddWordError]      = useState('');

  // Disambiguation modal (206 response)
  const [disambigOptions, setDisambigOptions] = useState(null);
  const [disambigLoading, setDisambigLoading] = useState(false);

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
        setIsAddModalOpen(false);
        setAddWordInput('');
        showToast('success', `"${data.global_word?.word}" added to your Vocab Lab!`);
        fetchDashboard();
      } else if (res.status === 206) {
        // Disambiguation needed
        setDisambigOptions(data.options);
      } else if (res.status === 200 && data.duplicate) {
        showToast('success', data.message);
        setIsAddModalOpen(false);
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
        setIsAddModalOpen(false);
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

  // ── Practice tile config ───────────────────────────────────────────────────
  const practiceTiles = [
    {
      id: 'sentence',
      icon: PenTool,
      title: 'Sentence Builder',
      desc: 'Use words in context',
      color: 'from-violet-600 to-purple-700',
      onClick: () => showToast('success', 'Sentence Builder coming in Phase 4!'),
    },
    {
      id: 'families',
      icon: GitBranch,
      title: 'Word Families',
      desc: 'Explore related forms',
      color: 'from-sky-600 to-blue-700',
      onClick: () => showToast('success', 'Word Families coming in Phase 4!'),
    },
    {
      id: 'speak',
      icon: Mic,
      title: 'Speak It',
      desc: 'Pronunciation practice',
      color: 'from-rose-600 to-pink-700',
      onClick: () => showToast('success', 'Speak It coming in Phase 4!'),
    },
    {
      id: 'add',
      icon: Plus,
      title: 'Add New Word',
      desc: 'Expand your lexicon',
      color: 'from-emerald-600 to-teal-700',
      onClick: () => { setAddWordInput(''); setAddWordError(''); setIsAddModalOpen(true); },
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
                    onClick={() => showToast('success', 'Full review mode coming in Phase 4!')}
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

              {/* Due Words Preview (if any) */}
              {dueToday.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Due Today</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {dueToday.slice(0, 6).map(w => {
                      const badge = srsLabel(w.srs_level);
                      return (
                        <div key={w.user_word_id} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-black text-slate-900 dark:text-white capitalize">{w.word}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                          </div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{w.part_of_speech}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{w.primary_definition}</p>
                        </div>
                      );
                    })}
                  </div>
                  {dueToday.length > 6 && (
                    <p className="text-xs text-slate-400 text-center mt-3">+{dueToday.length - 6} more words due</p>
                  )}
                </div>
              )}

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

              {/* Stats Panel */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5">Your Progress</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Trophy size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{stats.total_mastered}</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">Mastered Words</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{stats.total_learning}</p>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wide">Words Learning</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BookOpen size={20} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-700 dark:text-white">{stats.total_words}</p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total in Lab</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Starred Words */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex-1">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Starred Words</h4>
                  <Star size={15} className="text-amber-400" />
                </div>
                {starredWords.length === 0 ? (
                  <div className="text-center py-8">
                    <Star size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No starred words yet</p>
                    <p className="text-xs text-slate-400 mt-1">Star important words during review sessions</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {starredWords.map(w => (
                      <div key={w.user_word_id} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">{w.word}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{w.part_of_speech}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${srsLabel(w.srs_level).color}`}>
                          {srsLabel(w.srs_level).label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Library Button */}
              <button
                onClick={() => navigate('/vocab')}
                className="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                    <BookOpen size={17} className="text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">View Full Lexicon</p>
                    <p className="text-[10px] text-slate-400">Word Bank &amp; custom lists</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ══════════════ ADD WORD MODAL ══════════════ */}
      {isAddModalOpen && !disambigOptions && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setIsAddModalOpen(false); setAddWordError(''); }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between"
              style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}>
              <div>
                <h3 className="font-black text-xl text-white">Add a Word</h3>
                <p className="text-xs text-white/70 mt-0.5">Search the Academic Word Dictionary</p>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setAddWordError(''); }}
                className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddWord} className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Enter a vocabulary word
                </label>
                <input
                  type="text"
                  value={addWordInput}
                  onChange={e => { setAddWordInput(e.target.value); setAddWordError(''); }}
                  placeholder="e.g. analyze, concept, assess..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': brandPrimary }}
                />
                {addWordError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2 font-semibold">
                    <AlertCircle size={13} /> {addWordError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setAddWordError(''); }}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addWordLoading || !addWordInput.trim()}
                  className="flex-1 py-3 rounded-2xl text-white font-black text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})` }}
                >
                  {addWordLoading ? <><Loader2 size={16} className="animate-spin" /> Searching...</> : <><Plus size={16} /> Add to Lab</>}
                </button>
              </div>
            </form>
          </div>
        </div>
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

      {/* ══════════════ TOAST ══════════════ */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
