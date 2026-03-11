import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, AlertCircle, FileText, CheckCircle2, Shield, Clock, Plus, Minus, Loader2 } from 'lucide-react';

const GRAMMAR_GROUPS = [
  {
    title: 'Grammar & Accuracy',
    categories: [
      'Article Usage',
      'Prepositional Accuracy',
      'Subject-Verb Agreement',
      'Tense Consistency',
      'Present Perfect vs. Past Simple',
      'Gerunds vs. Infinitives',
      'Passive Voice Construction',
      'Sentence Boundaries (Fragments/Comma Splices)',
      'Relative Clauses',
      'Subordination',
      'Word Order',
      'Parallel Structure'
    ]
  },
  {
    title: 'Lexical Resource',
    categories: [
      'Countability & Plurals',
      'Word Forms',
      'Collocations',
      'Academic Register',
      'Nominalization'
    ]
  },
  {
    title: 'Coherence & Cohesion',
    categories: [
      'Pronoun Reference',
      'Transitional Devices'
    ]
  },
  {
    title: 'Task Response/Achievement',
    categories: ['Hedging']
  }
];

const CATEGORY_LABELS = {
  'Article Usage': 'Articles',
  'Sentence Boundaries (Fragments/Comma Splices)': 'Sentence Boundaries'
};

export default function StudentReview({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState(null);
  const [grammarProgress, setGrammarProgress] = useState([]);
  const [grammarError, setGrammarError] = useState('');
  const [isGrammarLoading, setIsGrammarLoading] = useState(true);
  const [grammarUpdateKey, setGrammarUpdateKey] = useState('');
  const [grammarSuccessByCategory, setGrammarSuccessByCategory] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSubmissionIndex, setActiveSubmissionIndex] = useState(0);
  const grammarSuccessTimeoutsRef = useRef({});
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/api/scores/student/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch student data');
        
        setStudentData(data);

        try {
          setIsGrammarLoading(true);
          setGrammarError('');
          const grammarRes = await fetch(`${apiBase}/api/grammar-progress/student/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const grammarData = await grammarRes.json();
          if (!grammarRes.ok) throw new Error(grammarData.error || 'Failed to fetch grammar progress');
          setGrammarProgress(Array.isArray(grammarData.progress) ? grammarData.progress : []);
        } catch (grammarErr) {
          setGrammarError(grammarErr.message || 'Failed to fetch grammar progress');
          setGrammarProgress([]);
        } finally {
          setIsGrammarLoading(false);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [id, apiBase]);

  useEffect(() => {
    return () => {
      Object.values(grammarSuccessTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 font-medium">Loading student data...</div>;
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Failed to Load Profile</h2>
          <p className="text-slate-500 text-sm mb-6">{error || 'Unknown error occurred.'}</p>
          <button onClick={() => navigate('/dashboard')} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">Return to Roster</button>
        </div>
      </div>
    );
  }

  const ieltsSubmissions = (studentData.submissions || []).filter((submission) => submission.module_type === 'writing');
  const safeActiveSubmissionIndex = Math.min(activeSubmissionIndex, Math.max(ieltsSubmissions.length - 1, 0));
  const activeSubmission = ieltsSubmissions.length > 0
    ? ieltsSubmissions[safeActiveSubmissionIndex]
    : null;

  const updateGrammarProgress = async (errorCategory, field, delta) => {
    const target = grammarProgress.find((item) => item.error_category === errorCategory);
    if (!target || grammarUpdateKey.startsWith(`${errorCategory}:`)) return;

    const nextLevel = field === 'current_level'
      ? Math.max(1, Math.min(4, Number(target.current_level) + delta))
      : Number(target.current_level);
    const nextExercises = field === 'exercises_completed'
      ? Math.max(0, Number(target.exercises_completed) + delta)
      : Number(target.exercises_completed);

    if (nextLevel === Number(target.current_level) && nextExercises === Number(target.exercises_completed)) {
      return;
    }

    const updateKey = `${errorCategory}:${field}:${delta > 0 ? 'plus' : 'minus'}`;
    setGrammarUpdateKey(updateKey);
    setGrammarError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/grammar-progress/student/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          error_category: errorCategory,
          current_level: nextLevel,
          exercises_completed: nextExercises
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update grammar progress');

      setGrammarProgress(Array.isArray(data.progress) ? data.progress : grammarProgress);
      setGrammarSuccessByCategory((prev) => ({ ...prev, [errorCategory]: true }));

      if (grammarSuccessTimeoutsRef.current[errorCategory]) {
        clearTimeout(grammarSuccessTimeoutsRef.current[errorCategory]);
      }

      grammarSuccessTimeoutsRef.current[errorCategory] = setTimeout(() => {
        setGrammarSuccessByCategory((prev) => {
          const next = { ...prev };
          delete next[errorCategory];
          return next;
        });
        delete grammarSuccessTimeoutsRef.current[errorCategory];
      }, 1500);
    } catch (err) {
      setGrammarError(err.message || 'Failed to update grammar progress');
    } finally {
      setGrammarUpdateKey('');
    }
  };

  const isUpdatingButton = (errorCategory, field, delta) => {
    const key = `${errorCategory}:${field}:${delta > 0 ? 'plus' : 'minus'}`;
    return grammarUpdateKey === key;
  };

  const isCategoryUpdating = (errorCategory) => grammarUpdateKey.startsWith(`${errorCategory}:`);
  const progressByCategory = new Map(grammarProgress.map((item) => [item.error_category, item]));
  const configuredCategories = new Set(GRAMMAR_GROUPS.flatMap((group) => group.categories));
  const groupedGrammarProgress = GRAMMAR_GROUPS.map((group) => ({
    ...group,
    items: group.categories.map((category) => progressByCategory.get(category)).filter(Boolean)
  }));
  const uncategorizedItems = grammarProgress.filter((item) => !configuredCategories.has(item.error_category));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors border border-slate-200"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-black text-slate-900 tracking-tight text-xl leading-none">
              {studentData.student.first_name} {studentData.student.last_name}
            </h1>
            <span className="text-xs font-bold text-slate-500">{studentData.student.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 flex items-center gap-2">
            <BookOpen size={14} /> IELTS Submissions: {ieltsSubmissions.length}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">IELTS Writing History</h2>

          {ieltsSubmissions.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center max-w-3xl">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-slate-900 mb-2">No IELTS Writing Submissions Yet</h3>
              <p className="text-slate-500 font-medium">This student hasn't completed any IELTS writing modules yet. Once they practice, their writing history will appear here.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><FileText className="text-indigo-600" /> Submission Detail</h3>
                {ieltsSubmissions.length > 1 && (
                  <select
                    className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-2.5 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={safeActiveSubmissionIndex}
                    onChange={(e) => setActiveSubmissionIndex(Number(e.target.value))}
                  >
                    {ieltsSubmissions.map((sub, idx) => (
                      <option key={sub.id} value={idx}>
                        Attempt {ieltsSubmissions.length - idx}: {new Date(sub.completed_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2">
                <div className="p-8 border-r border-slate-100">
                  <div className="flex flex-col gap-1 mb-6 border-b border-slate-100 pb-6">
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-2"><BookOpen size={12}/> IELTS Writing</div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">{activeSubmission.module_name} — {activeSubmission.module_type}</h3>
                    <div className="text-sm font-bold text-slate-400 mt-2 flex items-center gap-4">
                       <span className="flex items-center gap-1.5"><Clock size={14}/> {new Date(activeSubmission.completed_at).toLocaleString()}</span>
                       <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">{activeSubmission.word_count} words</span>
                    </div>
                 </div>
                 
                 <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                   {activeSubmission.submitted_text}
                 </div>
                </div>

                <div className="p-8 bg-slate-50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Shield className="text-indigo-600" /> AI Examiner Breakdown</h3>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-950 to-indigo-900 rounded-3xl p-8 text-white shadow-glow mb-6 relative overflow-hidden">
                     <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                     <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1 text-center md:text-left">
                           <div className="inline-block px-3 py-1 bg-indigo-800/50 rounded-full text-[10px] font-black tracking-widest text-indigo-300 border border-indigo-700 uppercase mb-4">Official Rating</div>
                           <h3 className="text-3xl font-black tracking-tight mb-2">Overall Band Score</h3>
                           {activeSubmission.ai_feedback?.modelHighlights && (
                             <p className="text-indigo-200 text-sm italic font-medium">"{activeSubmission.ai_feedback.modelHighlights}"</p>
                           )}
                        </div>
                        <div className="w-32 h-32 shrink-0 bg-white rounded-full flex flex-col items-center justify-center p-2 shadow-2xl border-4 border-indigo-500">
                           <span className="text-5xl font-black text-indigo-950 tracking-tighter">{activeSubmission.overall_score}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Task Achievement</span>
                        <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.taskAchievement?.score || '-'}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.taskAchievement?.comments || 'No comments provided.'}</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Coherence & Cohesion</span>
                        <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.coherence?.score || '-'}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.coherence?.comments || 'No comments provided.'}</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Lexical Resource</span>
                        <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.lexicalResource?.score || '-'}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.lexicalResource?.comments || 'No comments provided.'}</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Grammar & Accuracy</span>
                        <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.grammaticalRange?.score || '-'}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.grammaticalRange?.comments || 'No comments provided.'}</p>
                    </div>
                  </div>

                  {activeSubmission.ai_feedback?.actionableAdvice && activeSubmission.ai_feedback.actionableAdvice.length > 0 && (
                    <div className="bg-slate-900 p-8 rounded-3xl shadow-glow text-white">
                      <h3 className="font-black text-lg mb-6 flex items-center gap-2 tracking-tight"><CheckCircle2 className="text-green-400"/> Primary Improvement Areas</h3>
                      <ul className="space-y-4">
                        {activeSubmission.ai_feedback.actionableAdvice.map((advice, idx) => (
                          <li key={idx} className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div className="w-6 h-6 shrink-0 bg-indigo-500 text-white rounded-full flex justify-center items-center text-xs font-black">{idx + 1}</div>
                            <p className="text-sm font-medium text-slate-200 pt-0.5 leading-relaxed">{advice}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Grammar Mastery</h2>

          {isGrammarLoading ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-slate-400">Loading grammar progress...</div>
          ) : grammarError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-bold">{grammarError}</div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="space-y-6">
                {groupedGrammarProgress.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 mb-3">{group.title}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.items.map((item) => {
                        const levelValue = Number(item.current_level);
                        const categorySuccess = !!grammarSuccessByCategory[item.error_category];

                        return (
                          <div
                            key={item.error_category}
                            className={`rounded-2xl border p-4 transition-colors ${categorySuccess ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <h4 className="text-sm font-bold text-slate-900 leading-snug">{CATEGORY_LABELS[item.error_category] || item.error_category}</h4>
                              {categorySuccess && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-100 border border-green-200 rounded-md px-2 py-1">
                                  <CheckCircle2 size={12} /> Saved
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">Level: {levelValue}</span>
                                <div className="flex items-center gap-1" aria-label={`Level ${levelValue} of 4`}>
                                  {[1, 2, 3, 4].map((dot) => (
                                    <span
                                      key={dot}
                                      className={`w-2.5 h-2.5 rounded-full ${levelValue >= dot ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateGrammarProgress(item.error_category, 'current_level', -1)}
                                  disabled={levelValue <= 1 || isCategoryUpdating(item.error_category)}
                                  className="w-6 h-6 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                                  title="Decrease level"
                                >
                                  {isUpdatingButton(item.error_category, 'current_level', -1) ? <Loader2 size={12} className="animate-spin" /> : <Minus size={12} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateGrammarProgress(item.error_category, 'current_level', 1)}
                                  disabled={levelValue >= 4 || isCategoryUpdating(item.error_category)}
                                  className="w-6 h-6 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                                  title="Increase level"
                                >
                                  {isUpdatingButton(item.error_category, 'current_level', 1) ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-slate-500 font-medium">Exercises completed: <span className="font-bold text-slate-700">{item.exercises_completed}</span></p>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateGrammarProgress(item.error_category, 'exercises_completed', -1)}
                                  disabled={Number(item.exercises_completed) <= 0 || isCategoryUpdating(item.error_category)}
                                  className="w-6 h-6 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                                  title="Decrease completed exercises"
                                >
                                  {isUpdatingButton(item.error_category, 'exercises_completed', -1) ? <Loader2 size={12} className="animate-spin" /> : <Minus size={12} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateGrammarProgress(item.error_category, 'exercises_completed', 1)}
                                  disabled={isCategoryUpdating(item.error_category)}
                                  className="w-6 h-6 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                                  title="Increase completed exercises"
                                >
                                  {isUpdatingButton(item.error_category, 'exercises_completed', 1) ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {uncategorizedItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 mb-3">Other</h3>
                    <div className="text-xs text-slate-500 font-medium bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
                      Additional categories found: {uncategorizedItems.map((item) => item.error_category).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
