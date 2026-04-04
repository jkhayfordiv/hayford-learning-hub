import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, AlertCircle,
  PenLine, Lightbulb, Trophy, RotateCcw, ChevronRight, Loader2,
  FileText, Layers, Target, Sparkles, Send, ListChecks, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MODEL_ANSWERS, MODEL_ANSWER_FALLBACK } from './modelAnswers';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

const GENRES = [
  'Opinion / Argumentative',
  'Cause & Effect',
  'Compare & Contrast',
  'Problem & Solution',
  'Descriptive / Narrative',
];

const SENTENCE_STARTERS = {
  'Opinion / Argumentative': {
    topic: ['In my opinion, ...', 'I strongly believe that ...', 'It is clear that ...'],
    detail: ['This is important because ...', 'For example, ...', 'Furthermore, ...', 'Additionally, ...'],
    conclusion: ['In conclusion, ...', 'To summarise, ...', 'Therefore, it is evident that ...'],
  },
  'Cause & Effect': {
    topic: ['There are several reasons why ...', 'The issue of ... has significant effects.', 'Understanding the causes of ... is essential.'],
    detail: ['The main reason is ...', 'This leads to ...', 'As a result, ...', 'Consequently, ...'],
    conclusion: ['In conclusion, the effects of ... are clear.', 'To summarise, the main causes are ...', 'Overall, this shows that ...'],
  },
  'Compare & Contrast': {
    topic: ['While ... and ... share some similarities, they differ in key ways.', 'Comparing ... and ... reveals important distinctions.'],
    detail: ['Similarly, ...', 'On the other hand, ...', 'In contrast, ...', 'However, ...'],
    conclusion: ['In conclusion, both ... and ... have their merits.', 'Overall, the differences outweigh the similarities.'],
  },
  'Problem & Solution': {
    topic: ['... is a serious problem that requires immediate attention.', 'The issue of ... affects many people today.'],
    detail: ['The main problem is ...', 'One effective solution is ...', 'This would help because ...', 'Another approach could be ...'],
    conclusion: ['In conclusion, addressing this problem requires ...', 'To summarise, the best solution is ...'],
  },
  'Descriptive / Narrative': {
    topic: ['It was a day I will never forget.', 'The scene before me was ...', 'I can vividly remember when ...'],
    detail: ['The atmosphere was ...', 'I noticed that ...', 'Suddenly, ...', 'At that moment, ...'],
    conclusion: ['Looking back, ...', 'That experience taught me ...', 'In the end, ...'],
  },
};

const TARGET_LANGUAGE = {
  'Opinion / Argumentative': [
    'furthermore', 'moreover', 'undoubtedly', 'in my view',
    'critics argue', 'nevertheless', 'it is argued', 'admittedly',
    'on balance', 'it is clear that',
  ],
  'Cause & Effect': [
    'consequently', 'therefore', 'as a result', 'due to',
    'because of', 'this leads to', 'thus', 'hence',
    'for this reason', 'subsequently',
  ],
  'Compare & Contrast': [
    'similarly', 'on the other hand', 'in contrast', 'however',
    'whereas', 'by comparison', 'despite this', 'in the same way',
    'unlike', 'conversely',
  ],
  'Problem & Solution': [
    'the main problem', 'one solution', 'it is recommended',
    'in order to', 'effectively', 'to tackle',
    'significantly', 'an effective measure', 'a key solution', 'this would help',
  ],
  'Descriptive / Narrative': [
    'initially', 'subsequently', 'eventually', 'vividly',
    'at this point', 'as time passed', 'remarkably',
    'in the distance', 'without warning', 'overcome with',
  ],
};

const STEPS = [
  { id: 0, label: 'Configure',  icon: Target },
  { id: 1, label: 'Plan',       icon: Layers },
  { id: 2, label: 'First Draft',icon: PenLine },
  { id: 3, label: 'Revise',     icon: Sparkles },
  { id: 4, label: 'Results',    icon: Trophy },
];

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
}

function wordCount(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

const MD_COMPONENTS = {
  h3: ({ children }) => (
    <h3 className="text-base font-black text-slate-900 dark:text-white mt-1 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">{children}</h3>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">{children}</h2>
  ),
  p: ({ children }) => (
    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-black text-slate-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="not-italic font-bold text-teal-700 dark:text-teal-400">{children}</em>
  ),
  hr: () => (
    <hr className="border-slate-200 dark:border-slate-700 my-5" />
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-3 pl-2">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{children}</li>
  ),
};

function StarterPill({ text, onInsert }) {
  return (
    <button
      type="button"
      onClick={() => onInsert(text)}
      className="text-xs px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full hover:bg-teal-100 transition-colors font-medium"
    >
      {text}
    </button>
  );
}

export default function App({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id'), 10) : null;

  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Config (Step 0)
  const [config, setConfig] = useState({ level: 'paragraph', genre: 'Opinion / Argumentative', support_level: 'light' });
  const [assignmentLocked, setAssignmentLocked] = useState(false);

  // Planning (Step 1)
  const [planningData, setPlanningData] = useState({ topic_sentence: '', details: ['', '', ''], conclusion: '' });

  // Drafts
  const [draft1, setDraft1] = useState('');
  const [draft2, setDraft2] = useState('');

  // AI Peer Review
  const [aiHints, setAiHints] = useState([]);
  const [isPeerReviewLoading, setIsPeerReviewLoading] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  // Results (Step 4)
  const [results, setResults] = useState(null);

  const starters = SENTENCE_STARTERS[config.genre] || SENTENCE_STARTERS['Opinion / Argumentative'];

  // If assignment_id present, fetch assignment config and lock it
  useEffect(() => {
    if (!assignmentId) return;
    const fetchAssignment = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/assignments/my-tasks`, { headers: authHeaders() });
        if (!res.ok) return;
        const tasks = await res.json();
        const task = tasks.find(t => t.id === assignmentId);
        if (task?.writing_lab_config) {
          setConfig({
            level: task.writing_lab_config.level || 'paragraph',
            genre: task.writing_lab_config.genre || 'Opinion / Argumentative',
            support_level: task.writing_lab_config.support_level || 'light',
          });
          setAssignmentLocked(true);
        }
      } catch (err) {
        console.error('Failed to fetch assignment config', err);
      }
    };
    fetchAssignment();
  }, [assignmentId]);

  const saveSession = useCallback(async (updates) => {
    if (!sessionId) return;
    setIsSaving(true);
    try {
      await fetch(`${API_BASE}/api/writing-lab/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Autosave failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId]);

  // Step 0 → 1: Create session
  const handleStartPlanning = async () => {
    setError('');
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/writing-lab/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ assignment_id: assignmentId, configuration: config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session.');
      setSessionId(data.id);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Step 1 → 2: Save planning data
  const handleStartDraft = async () => {
    setError('');
    if (!planningData.topic_sentence.trim()) {
      setError('Please write a topic sentence before continuing.');
      return;
    }
    const stitched = [
      planningData.topic_sentence,
      ...planningData.details.filter(d => d.trim()),
      planningData.conclusion,
    ].filter(Boolean).join(' ');
    setDraft1(stitched);
    await saveSession({ planning_data: planningData, draft_1_text: stitched, status: 'drafting' });
    setStep(2);
  };

  // Step 2 → 3: Send first draft to AI peer review endpoint
  const handleGetAIPeerReview = async () => {
    setError('');
    if (wordCount(draft1) < 30) {
      setError('Please write at least 30 words before requesting AI feedback.');
      return;
    }
    if (!sessionId) {
      setError('Session not found. Please restart.');
      return;
    }
    setIsPeerReviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/writing-lab/sessions/${sessionId}/peer-review`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ draft_1_text: draft1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The AI tutor could not review your draft. Please try again.');
      setAiHints(Array.isArray(data.hints) ? data.hints : []);
      setDraft2(draft1);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPeerReviewLoading(false);
    }
  };

  // Step 3: Submit final draft
  const handleSubmit = async () => {
    setError('');
    if (wordCount(draft2) < 30) {
      setError('Your final draft needs at least 30 words.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/writing-lab/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ draft_2_text: draft2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed. Please try again.');
      setResults(data);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertStarterIntoField = (field, text, index) => {
    if (field === 'topic_sentence') {
      setPlanningData(p => ({ ...p, topic_sentence: p.topic_sentence ? p.topic_sentence + ' ' + text : text }));
    } else if (field === 'detail') {
      setPlanningData(p => {
        const details = [...p.details];
        details[index] = details[index] ? details[index] + ' ' + text : text;
        return { ...p, details };
      });
    } else if (field === 'conclusion') {
      setPlanningData(p => ({ ...p, conclusion: p.conclusion ? p.conclusion + ' ' + text : text }));
    }
  };

  const showStarters = config.support_level === 'heavy';
  const targetWords = TARGET_LANGUAGE[config.genre] || [];
  const usedCount = targetWords.filter(w => draft1.toLowerCase().includes(w.toLowerCase())).length;

  const bandColor = (band) => {
    if (band >= 7) return 'from-emerald-500 to-green-600';
    if (band >= 5.5) return 'from-amber-400 to-amber-500';
    return 'from-red-400 to-rose-500';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Nav */}
      <header className="bg-gradient-to-r from-teal-700 to-cyan-900 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2 text-white">
              <BookOpen size={22} />
              <span className="font-black text-lg tracking-tight">Writing Lab</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-teal-100 text-sm">
            {isPeerReviewLoading && <><Sparkles size={14} className="animate-pulse" /><span>AI reviewing…</span></>}
            {!isPeerReviewLoading && isSaving && <><Loader2 size={14} className="animate-spin" /><span>Saving…</span></>}
            {assignmentId && <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">Assignment Mode</span>}
          </div>
        </div>

        {/* Step progress bar */}
        {step < 4 && (
          <div className="max-w-5xl mx-auto px-4 pb-4">
            <div className="flex items-center gap-0">
              {STEPS.slice(0, 4).map((s, i) => {
                const Icon = s.icon;
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      active ? 'bg-white text-teal-800' : done ? 'text-teal-200' : 'text-teal-400'
                    }`}>
                      {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < 3 && <ChevronRight size={12} className="text-teal-500 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── STEP 0: Configuration ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <Target size={20} className="text-teal-700" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Configure Your Writing</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Set up your task before you begin.</p>
                </div>
              </div>

              {assignmentLocked && (
                <div className="mb-6 flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-700 px-4 py-3 rounded-xl text-sm font-medium">
                  <CheckCircle2 size={15} className="shrink-0" />
                  Configuration set by your teacher. Fields are locked.
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Writing Level</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['paragraph', 'essay'].map(level => (
                      <button
                        key={level}
                        type="button"
                        disabled={assignmentLocked}
                        onClick={() => setConfig(c => ({ ...c, level }))}
                        className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                          config.level === level
                            ? 'border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'
                        } ${assignmentLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Genre</label>
                  <select
                    value={config.genre}
                    disabled={assignmentLocked}
                    onChange={e => setConfig(c => ({ ...c, genre: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Support Level</label>
                  {[
                    { value: 'heavy', label: 'Heavy Scaffolding', desc: 'Sentence starters shown throughout' },
                    { value: 'light', label: 'Light Guidance',    desc: 'Structure provided, no starters' },
                    { value: 'independent', label: 'Independent', desc: 'Blank canvas — you decide everything' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={assignmentLocked}
                      onClick={() => setConfig(c => ({ ...c, support_level: value }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        config.support_level === value
                          ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      } ${assignmentLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <p className={`font-bold text-sm ${config.support_level === value ? 'text-teal-800 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleStartPlanning}
                  disabled={isSaving}
                  className="w-full mt-2 py-4 bg-gradient-to-r from-teal-700 to-cyan-800 hover:from-teal-800 hover:to-cyan-900 text-white font-black rounded-2xl shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                  Start Planning
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Planning ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <Layers size={20} className="text-teal-700" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Plan Your {config.level === 'essay' ? 'Essay' : 'Paragraph'}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{config.genre} · {config.level.charAt(0).toUpperCase() + config.level.slice(1)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModelAnswer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors shrink-0"
              >
                <FileText size={12} /> View Model Answer
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
              {/* Topic Sentence */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Topic Sentence</label>
                {showStarters && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {starters.topic.map(t => (
                      <StarterPill key={t} text={t} onInsert={text => insertStarterIntoField('topic_sentence', text)} />
                    ))}
                  </div>
                )}
                <textarea
                  rows={2}
                  value={planningData.topic_sentence}
                  onChange={e => setPlanningData(p => ({ ...p, topic_sentence: e.target.value }))}
                  placeholder={
                    config.support_level === 'heavy'
                      ? starters.topic[0]
                      : config.support_level === 'light'
                      ? 'Write a clear topic sentence that states your main argument…'
                      : 'Topic sentence…'
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* Supporting Details */}
              {planningData.details.map((detail, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supporting Detail {i + 1}</label>
                  {showStarters && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {starters.detail.slice(0, 3).map(t => (
                        <StarterPill key={t} text={t} onInsert={text => insertStarterIntoField('detail', text, i)} />
                      ))}
                    </div>
                  )}
                  <textarea
                    rows={2}
                    value={detail}
                    onChange={e => {
                      const details = [...planningData.details];
                      details[i] = e.target.value;
                      setPlanningData(p => ({ ...p, details }));
                    }}
                    placeholder={
                      config.support_level === 'heavy'
                        ? (starters.detail[i] || starters.detail[0])
                        : config.support_level === 'light'
                        ? `Support point ${i + 1}: add evidence, an example, or an explanation…`
                        : `Detail ${i + 1}…`
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
              ))}

              {/* Concluding Sentence */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Concluding Sentence</label>
                {showStarters && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {starters.conclusion.map(t => (
                      <StarterPill key={t} text={t} onInsert={text => insertStarterIntoField('conclusion', text)} />
                    ))}
                  </div>
                )}
                <textarea
                  rows={2}
                  value={planningData.conclusion}
                  onChange={e => setPlanningData(p => ({ ...p, conclusion: e.target.value }))}
                  placeholder={
                    config.support_level === 'heavy'
                      ? starters.conclusion[0]
                      : config.support_level === 'light'
                      ? 'Summarise your main point and reinforce your argument…'
                      : 'Concluding sentence…'
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleStartDraft}
                disabled={isSaving}
                className="flex-1 py-3 bg-gradient-to-r from-teal-700 to-cyan-800 hover:from-teal-800 hover:to-cyan-900 text-white font-black rounded-2xl shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Write First Draft
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: First Draft ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <PenLine size={20} className="text-teal-700" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">First Draft</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{config.genre} · Write freely, then get AI feedback.</p>
                </div>
                <button
                  onClick={() => setShowModelAnswer(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors shrink-0"
                >
                  <FileText size={12} /> View Model Answer
                </button>
              </div>
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${
                wordCount(draft1) < 30 ? 'text-slate-500 border-slate-200 bg-slate-50' : 'text-teal-700 border-teal-200 bg-teal-50'
              }`}>
                {wordCount(draft1)} words
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Draft editor */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                  <PenLine size={14} className="text-teal-600" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Your Draft</span>
                </div>
                <div className="relative flex-1">
                  <textarea
                    rows={20}
                    value={draft1}
                    onChange={e => setDraft1(e.target.value)}
                    disabled={isPeerReviewLoading}
                    placeholder="Expand your planning notes into full sentences. Focus on ideas — grammar can be polished after AI review…"
                    className="w-full bg-transparent px-5 py-4 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed disabled:opacity-40"
                  />
                  {isPeerReviewLoading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <Loader2 size={28} className="text-teal-600 animate-spin" />
                        <Sparkles size={22} className="text-teal-500 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-slate-800 dark:text-white text-base">AI tutor is reviewing your draft…</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Identifying 3 areas to help you improve</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-teal-50/50 dark:bg-teal-900/20 flex items-center gap-2">
                  <Lightbulb size={13} className="text-teal-600 shrink-0" />
                  <p className="text-xs text-teal-700 dark:text-teal-300 font-medium">Focus on ideas first — grammar gets reviewed by the AI in the next step.</p>
                </div>
              </div>

              {/* Right: Target Language Checklist */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks size={14} className="text-violet-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-400">Target Language</span>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full transition-all ${
                    usedCount === targetWords.length && targetWords.length > 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
                  }`}>
                    {usedCount} / {targetWords.length} used
                  </span>
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                    Try to use these phrases in your draft
                  </p>
                  <div className="space-y-2">
                    {targetWords.map(word => {
                      const used = draft1.toLowerCase().includes(word.toLowerCase());
                      return (
                        <div
                          key={word}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                            used
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-700'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                            used ? 'bg-emerald-500' : 'border-2 border-slate-300 dark:border-slate-600'
                          }`}>
                            {used && <span className="text-white text-[9px] font-black leading-none">✓</span>}
                          </div>
                          <span className={`text-sm font-medium transition-all duration-200 ${
                            used
                              ? 'text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {word}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {usedCount > 0 && (
                    <div className={`mt-4 rounded-2xl p-3 text-center text-xs font-bold border transition-all ${
                      usedCount === targetWords.length
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800'
                    }`}>
                      {usedCount === targetWords.length
                        ? '🎉 Outstanding! Every target phrase used!'
                        : `✨ ${usedCount} phrase${usedCount > 1 ? 's' : ''} used — keep going!`}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleGetAIPeerReview}
                disabled={isPeerReviewLoading || wordCount(draft1) < 30}
                className="flex-1 py-3 bg-gradient-to-r from-teal-700 to-cyan-800 hover:from-teal-800 hover:to-cyan-900 text-white font-black rounded-2xl shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPeerReviewLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Reviewing your draft…</>
                  : <><Sparkles size={16} /> Get AI Peer Review →</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Revision (Split Screen) ─────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <Sparkles size={20} className="text-teal-700" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Revise Your Draft</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Improve your writing based on the guidance below.</p>
                </div>
              </div>
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${
                wordCount(draft2) < 30 ? 'text-slate-500 border-slate-200 bg-slate-50' : 'text-teal-700 border-teal-200 bg-teal-50'
              }`}>
                {wordCount(draft2)} words
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Editor */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                  <PenLine size={14} className="text-teal-600" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Final Draft</span>
                </div>
                <textarea
                  rows={20}
                  value={draft2}
                  onChange={e => setDraft2(e.target.value)}
                  placeholder="Revise your first draft here…"
                  className="flex-1 w-full bg-transparent px-5 py-4 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Right: AI Peer Review Hints */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-teal-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-teal-700 dark:text-teal-400">AI Peer Review</span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-500 bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 rounded-full">{aiHints.length} hints</span>
                </div>
                <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                  {aiHints.length > 0 ? (
                    <>
                      {aiHints.map((hint, i) => {
                        const palette = [
                          { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', badge: 'bg-indigo-600', label: 'text-indigo-800 dark:text-indigo-300', body: 'text-indigo-700 dark:text-indigo-300' },
                          { bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800',  badge: 'bg-amber-500',  label: 'text-amber-800 dark:text-amber-300',  body: 'text-amber-700 dark:text-amber-300' },
                          { bg: 'bg-rose-50 dark:bg-rose-900/20',    border: 'border-rose-200 dark:border-rose-800',    badge: 'bg-rose-600',    label: 'text-rose-800 dark:text-rose-300',    body: 'text-rose-700 dark:text-rose-300' },
                        ];
                        const p = palette[i] || palette[0];
                        return (
                          <div key={i} className={`rounded-2xl p-4 border ${p.bg} ${p.border}`}>
                            <div className="flex items-start gap-3">
                              <span className={`flex-shrink-0 w-5 h-5 rounded-full ${p.badge} text-white text-[10px] font-black flex items-center justify-center mt-0.5`}>{i + 1}</span>
                              <div>
                                <p className={`font-black text-xs uppercase tracking-widest mb-1.5 ${p.label}`}>{hint.category}</p>
                                <p className={`text-sm leading-relaxed ${p.body}`}>{hint.message}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-6">
                      <Sparkles size={32} className="text-teal-400 mb-3" />
                      <p className="text-sm font-bold text-slate-500">No suggestions yet. Let the AI tutor review your first draft!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || wordCount(draft2) < 30}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white font-black rounded-2xl shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Submit Final Draft
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Results ─────────────────────────────────────────────── */}
        {step === 4 && results && (
          <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
              <div className={`py-12 text-center text-white bg-gradient-to-br ${bandColor(results.overall_score)} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Trophy size={160} />
                </div>
                <div className="relative z-10">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
                    <Trophy size={40} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-2">Submission Complete!</h2>
                  <p className="text-white/80 font-bold uppercase tracking-widest text-xs">Estimated Band Score</p>
                  <div className="text-7xl font-black mt-2 drop-shadow-lg">{results.overall_score}</div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Content', score: results.content_score, icon: Target },
                    { label: 'Organisation', score: results.organisation_score, icon: Layers },
                    { label: 'Vocabulary', score: results.vocabulary_score, icon: ListChecks },
                    { label: 'Grammar', score: results.grammar_score, icon: PenLine },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={14} className="text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stat.score}</div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Evaluation */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center">
                      <Sparkles size={16} className="text-teal-700" />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white text-lg">AI Evaluation</h3>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                      {results.ai_evaluation}
                    </ReactMarkdown>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={18} /> Back to Hub
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} /> Try Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Model Answer Modal Overlay */}
      {showModelAnswer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <FileText size={20} className="text-teal-700" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Model Answer</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{config.genre} · {config.level}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModelAnswer(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 prose prose-slate dark:prose-invert max-w-none bg-slate-50/50 dark:bg-slate-900/30">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {MODEL_ANSWERS[config.level]?.[config.genre] || MODEL_ANSWER_FALLBACK}
              </ReactMarkdown>
            </div>
            
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-center">
              <button
                onClick={() => setShowModelAnswer(false)}
                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                Close Model Answer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
