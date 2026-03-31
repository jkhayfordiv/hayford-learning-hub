import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Settings, ChevronLeft, ChevronRight, Shuffle, Volume2, X,
} from 'lucide-react';

function blankSentence(sentence, word) {
  if (!sentence || !word) return sentence || '';
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.replace(new RegExp(esc, 'gi'), '______');
}

function parseJSON(val) {
  if (!val) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

const DIRECTIONS = [
  { id: 'standard',     label: 'Standard',     desc: 'Word → Meaning' },
  { id: 'reverse',      label: 'Reverse',       desc: 'Meaning → Word' },
  { id: 'contextual',   label: 'Contextual',    desc: 'Fill-in-the-blank → Word' },
  { id: 'pronunciation',label: 'Pronunciation', desc: 'Word + Sentence → Audio' },
];

const STYLES = [
  { id: 'review', label: 'Review',       desc: 'Tap card to flip' },
  { id: 'recall', label: 'Active Recall', desc: 'Type the word to unlock' },
];

const DECK_OPTIONS = [
  { id: 'all',      label: 'All Words' },
  { id: 'learning', label: 'Learning Only' },
  { id: 'mastered', label: 'Mastered Only' },
  { id: 'starred',  label: 'Starred Only' },
];

function SettingsRadioGroup({ label, options, value, onChange, words, brandPrimary, brandDark }) {
  const countFor = (id) => {
    if (id === 'all')      return words.length;
    if (id === 'learning') return words.filter(w => w.srs_level < 5).length;
    if (id === 'mastered') return words.filter(w => w.srs_level >= 5).length;
    if (id === 'starred')  return words.filter(w => w.is_starred).length;
    return null;
  };

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{label}</p>
      <div className="space-y-2">
        {options.map(opt => {
          const active = value === opt.id;
          const count = countFor(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                active ? 'text-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
              style={active ? { background: `linear-gradient(to right, ${brandPrimary}, ${brandDark})`, borderColor: 'transparent' } : {}}
            >
              <div>
                <p className="font-bold text-sm">{opt.label}</p>
                {opt.desc && <p className="text-[11px] opacity-60 mt-0.5">{opt.desc}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {count !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    {count}
                  </span>
                )}
                {active && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FlashcardSandbox({ words, brandPrimary, brandDark, onClose }) {
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [isFlipped,       setIsFlipped]       = useState(false);
  const [studyDirection,  setStudyDirection]  = useState('standard');
  const [practiceStyle,   setPracticeStyle]   = useState('review');
  const [deckFilter,      setDeckFilter]      = useState('all');
  const [isSettingsOpen,  setIsSettingsOpen]  = useState(false);
  const [recallInput,     setRecallInput]     = useState('');
  const [recallError,     setRecallError]     = useState(false);

  const filteredDeck = useMemo(() => {
    switch (deckFilter) {
      case 'learning': return words.filter(w => w.srs_level < 5);
      case 'mastered': return words.filter(w => w.srs_level >= 5);
      case 'starred':  return words.filter(w => w.is_starred);
      default:         return [...words];
    }
  }, [words, deckFilter]);

  const [localDeck, setLocalDeck] = useState(filteredDeck);

  useEffect(() => {
    setLocalDeck(filteredDeck);
    setCurrentIndex(0);
    setIsFlipped(false);
    setRecallInput('');
    setRecallError(false);
    window.speechSynthesis?.cancel();
  }, [filteredDeck]);

  const currentWord = localDeck[currentIndex] ?? null;
  const collocations = currentWord ? (parseJSON(currentWord.collocations) || []) : [];

  // ── Pronunciation engine ────────────────────────────────────────────────────
  useEffect(() => {
    if (studyDirection === 'pronunciation' && isFlipped && currentWord) {
      window.speechSynthesis?.cancel();
      const u1 = new SpeechSynthesisUtterance(currentWord.word);
      u1.onend = () => {
        if (currentWord.context_sentence) {
          setTimeout(() => {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentWord.context_sentence));
          }, 500);
        }
      };
      window.speechSynthesis.speak(u1);
    }
  }, [isFlipped, currentIndex, studyDirection]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useCallback((delta) => {
    if (!localDeck.length) return;
    window.speechSynthesis?.cancel();
    setIsFlipped(false);
    setRecallInput('');
    setRecallError(false);
    setCurrentIndex(prev => {
      const next = prev + delta;
      if (next < 0) return localDeck.length - 1;
      if (next >= localDeck.length) return 0;
      return next;
    });
  }, [localDeck.length]);

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (isSettingsOpen) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') navigate(1);
      else if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === ' ') { e.preventDefault(); if (practiceStyle === 'review' && currentWord) setIsFlipped(f => !f); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, isSettingsOpen, practiceStyle, currentWord]);

  const handleFlip = () => {
    if (practiceStyle === 'review' && currentWord) setIsFlipped(f => !f);
  };

  const handleRecallSubmit = (e) => {
    e.preventDefault();
    if (!currentWord) return;
    if (recallInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
      setIsFlipped(true);
      setRecallInput('');
    } else {
      setRecallError(true);
      setTimeout(() => setRecallError(false), 600);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...localDeck].sort(() => Math.random() - 0.5);
    setLocalDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setRecallInput('');
    window.speechSynthesis?.cancel();
  };

  const handleDirectionChange = (dir) => {
    setStudyDirection(dir);
    setIsFlipped(false);
    setRecallInput('');
    window.speechSynthesis?.cancel();
  };

  const handleStyleChange = (style) => {
    setPracticeStyle(style);
    setIsFlipped(false);
    setRecallInput('');
  };

  // ── Card content renderers ──────────────────────────────────────────────────
  const renderFront = () => {
    if (!currentWord) return null;
    const POS = (
      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/20 rounded-full text-white/80">
        {currentWord.part_of_speech}
      </span>
    );

    if (studyDirection === 'reverse') return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        {POS}
        <p className="text-lg font-semibold text-white leading-relaxed">{currentWord.primary_definition}</p>
        <p className="text-[10px] text-white/40 mt-2">What is this word?</p>
      </div>
    );

    if (studyDirection === 'contextual') return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Fill in the blank</p>
        <p className="text-xl font-semibold text-white leading-relaxed italic">
          &ldquo;{blankSentence(currentWord.context_sentence, currentWord.word)}&rdquo;
        </p>
      </div>
    );

    if (studyDirection === 'pronunciation') return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <p className="text-4xl font-black text-white capitalize">{currentWord.word}</p>
        {POS}
        {currentWord.context_sentence && (
          <p className="text-sm text-white/70 leading-relaxed italic mt-2">&ldquo;{currentWord.context_sentence}&rdquo;</p>
        )}
        <p className="text-[10px] text-white/40 mt-2">Flip to hear pronunciation</p>
      </div>
    );

    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <p className="text-5xl font-black text-white capitalize tracking-tight">{currentWord.word}</p>
        {POS}
        <p className="text-[10px] text-white/40 mt-2">
          {practiceStyle === 'review' ? 'Tap card to reveal →' : 'Type the word above to unlock'}
        </p>
      </div>
    );
  };

  const renderBack = () => {
    if (!currentWord) return null;

    if (studyDirection === 'pronunciation') return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8">
        <div className="flex items-center gap-1.5">
          {[14, 28, 38, 28, 20, 32, 20, 28, 38, 28, 14].map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-white rounded-full"
              style={{ height: h, opacity: 0.7 + (i % 3) * 0.1, animation: `pulse ${0.8 + (i % 4) * 0.15}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
          <Volume2 size={26} className="text-white ml-3" />
        </div>
        <p className="text-sm text-white/60 uppercase tracking-widest font-bold">Listening…</p>
      </div>
    );

    const CollocationChips = collocations.length > 0 && (
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Collocations</p>
        <div className="flex flex-wrap gap-2">
          {collocations.slice(0, 5).map((c, i) => (
            <span key={i} className="text-xs px-2.5 py-1 bg-white/10 rounded-lg text-white/70">{c}</span>
          ))}
        </div>
      </div>
    );

    if (studyDirection === 'contextual') return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <p className="text-4xl font-black text-white capitalize">{currentWord.word}</p>
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/20 rounded-full text-white/80">{currentWord.part_of_speech}</span>
        <p className="text-sm text-white/80 leading-relaxed mt-2">{currentWord.primary_definition}</p>
      </div>
    );

    if (studyDirection === 'reverse') return (
      <div className="flex flex-col justify-center h-full gap-4 p-8 overflow-y-auto">
        <p className="text-4xl font-black text-white capitalize">{currentWord.word}</p>
        <span className="text-[10px] font-black uppercase tracking-widest w-fit px-2 py-0.5 bg-white/20 rounded-full text-white/80">{currentWord.part_of_speech}</span>
        {CollocationChips}
        {currentWord.context_sentence && (
          <p className="text-sm text-white/60 italic leading-relaxed border-t border-white/10 pt-3">&ldquo;{currentWord.context_sentence}&rdquo;</p>
        )}
      </div>
    );

    return (
      <div className="flex flex-col justify-center h-full gap-4 p-8 overflow-y-auto">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{currentWord.part_of_speech}</span>
        <p className="text-xl font-bold text-white leading-relaxed">{currentWord.primary_definition}</p>
        {CollocationChips}
        {currentWord.context_sentence && (
          <p className="text-sm text-white/60 italic leading-relaxed border-t border-white/10 pt-3">&ldquo;{currentWord.context_sentence}&rdquo;</p>
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: `linear-gradient(160deg, #1e1b4b 0%, #0f172a 100%)` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Flashcard Sandbox</p>
          {localDeck.length > 0 && (
            <p className="text-sm font-bold text-white">{currentIndex + 1} / {localDeck.length}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShuffle} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" title="Shuffle">
            <Shuffle size={17} />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" title="Settings">
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 gap-6">
        {localDeck.length === 0 ? (
          <div className="text-center">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-xl font-black text-white">No words match this filter</p>
            <p className="text-sm text-white/50 mt-2">Try a different Word Deck in Settings</p>
          </div>
        ) : (
          <>
            {/* 3D Card */}
            <div className="w-full max-w-2xl" style={{ perspective: '1000px' }}>
              <div
                className="relative w-full"
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  height: '300px',
                  cursor: practiceStyle === 'review' ? 'pointer' : 'default',
                }}
                onClick={handleFlip}
              >
                {/* Front face */}
                <div
                  className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl"
                  style={{
                    backfaceVisibility: 'hidden',
                    background: `linear-gradient(135deg, ${brandPrimary}ee, ${brandDark}ee)`,
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {renderFront()}
                </div>
                {/* Back face */}
                <div
                  className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {renderBack()}
                </div>
              </div>
            </div>

            {/* Active Recall input */}
            {practiceStyle === 'recall' && !isFlipped && (
              <form onSubmit={handleRecallSubmit} className="w-full max-w-2xl flex gap-3">
                <input
                  type="text"
                  value={recallInput}
                  onChange={e => { setRecallInput(e.target.value); setRecallError(false); }}
                  placeholder="Type the word…"
                  autoFocus
                  className={`flex-1 rounded-2xl px-5 py-3.5 font-medium text-white placeholder:text-white/30 focus:outline-none transition-all ${
                    recallError
                      ? 'bg-red-500/20 border-2 border-red-400 ring-0'
                      : 'bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15'
                  }`}
                />
                <button
                  type="submit"
                  className="px-6 py-3.5 bg-white/20 hover:bg-white/30 text-white font-black rounded-2xl transition-colors"
                >
                  Check
                </button>
              </form>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-colors">
                <ChevronLeft size={17} /> Prev
              </button>
              {practiceStyle === 'review' && currentWord && (
                <button onClick={() => setIsFlipped(f => !f)} className="px-5 py-3 bg-white/20 hover:bg-white/30 text-white font-black text-sm rounded-2xl transition-colors min-w-[120px]">
                  {isFlipped ? 'Hide' : 'Show Answer'}
                </button>
              )}
              <button onClick={() => navigate(1)} className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-colors">
                Next <ChevronRight size={17} />
              </button>
            </div>

            <p className="text-[10px] text-white/30 uppercase tracking-widest">← → Arrow keys to navigate · Space to flip</p>
          </>
        )}
      </div>

      {/* Settings modal */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between rounded-t-3xl z-10">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-7">
              <SettingsRadioGroup
                label="Study Direction"
                options={DIRECTIONS}
                value={studyDirection}
                onChange={handleDirectionChange}
                words={words}
                brandPrimary={brandPrimary}
                brandDark={brandDark}
              />
              <SettingsRadioGroup
                label="Practice Style"
                options={STYLES}
                value={practiceStyle}
                onChange={handleStyleChange}
                words={words}
                brandPrimary={brandPrimary}
                brandDark={brandDark}
              />
              <SettingsRadioGroup
                label="Word Deck"
                options={DECK_OPTIONS}
                value={deckFilter}
                onChange={setDeckFilter}
                words={words}
                brandPrimary={brandPrimary}
                brandDark={brandDark}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
