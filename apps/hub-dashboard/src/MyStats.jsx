import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, BarChart3, FileText, BookOpen } from 'lucide-react';

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function aggregateWeaknesses(scores) {
  const counts = {};
  scores.forEach((score) => {
    const tags = parseMaybeJson(score.diagnostic_data);
    if (!Array.isArray(tags)) return;
    tags.forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
}

const DIAGNOSTIC_TO_TOPIC_MAP = {
  'Article Usage': '01_article_usage',
  'Countability & Plurals': '02_countability_and_plurals',
  'Pronoun Reference': '03_pronoun_reference',
  'Prepositional Accuracy': '04_prepositional_accuracy',
  'Word Forms': '05_word_forms',
  'Subject-Verb Agreement': '06_subject_verb_agreement',
  'Tense Consistency': '07_tense_consistency',
  'Present Perfect vs. Past Simple': '08_present_perfect_past_simple',
  'Gerunds vs. Infinitives': '09_gerunds_infinitives',
  'Passive Voice Construction': '10_passive_voice',
  'Sentence Boundaries': '11_sentence_boundaries',
  'Relative Clauses': '12_relative_clauses',
  'Subordination': '13_subordination',
  'Word Order': '14_word_order',
  'Parallel Structure': '15_parallel_structure',
  'Transitional Devices': '16_transitional_devices',
  'Collocations': '17_collocations',
  'Academic Register': '18_academic_register',
  'Nominalization': '19_nominalization',
  'Hedging': '20_hedging'
};

export default function MyStats() {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) {}

  const [scores, setScores] = useState([]);
  const [grammarProgress, setGrammarProgress] = useState([]);
  const [topWeaknesses, setTopWeaknesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyScores = async () => {
      try {
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/api/scores/my-scores`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch your stats');
        setScores(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to fetch your stats');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchGrammarProgress = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/api/grammar-progress/my-progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.progress) {
          setGrammarProgress(data.progress);
        }
      } catch (err) {
        console.error('Failed to fetch grammar progress:', err);
      }
    };

    const fetchWeaknesses = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !user.id) return;
        const res = await fetch(`${apiBase}/api/users/${user.id}/weaknesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTopWeaknesses((data || []).map(w => ({ tag: w.category, count: w.error_count })));
        }
      } catch (err) {
        console.error('Failed to fetch weaknesses:', err);
      }
    };

    fetchMyScores();
    fetchGrammarProgress();
    fetchWeaknesses();
  }, [apiBase]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading your stats...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Unable to load My Stats</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center gap-4 sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 leading-none">My Stats</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">Track your progress and recurring weaknesses</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><BarChart3 size={16} /> Top Weaknesses</h2>
            {topWeaknesses.length === 0 ? (
              <p className="text-sm text-slate-500">No diagnostic data yet. Complete more submissions to unlock insights.</p>
            ) : (
              <div className="space-y-3">
                {topWeaknesses.map((item) => {
                  const maxCount = topWeaknesses[0]?.count || 1;
                  const width = Math.max(15, (item.count / maxCount) * 100);
                  return (
                    <div key={item.tag} className="group">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <div className="flex items-center gap-2">
                          <span>{item.tag}</span>
                          {DIAGNOSTIC_TO_TOPIC_MAP[item.tag] && (
                            <button
                              onClick={() => {
                                const topicId = DIAGNOSTIC_TO_TOPIC_MAP[item.tag];
                                window.location.href = `/grammar-lab?token=${localStorage.getItem('token')}&topicId=${topicId}`;
                              }}
                              className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-slate-700 transition-colors"
                            >
                              Practice →
                            </button>
                          )}
                        </div>
                        <span>{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <BookOpen size={16} /> Grammar Progress
            </h2>
            {grammarProgress.length === 0 ? (
              <p className="text-sm text-slate-500">No grammar practice yet. Start with Grammar Lab to track your progress.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {grammarProgress.map((topic) => (
                  <div key={topic.error_category} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xs font-bold text-slate-900">{topic.error_category}</h3>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                        Level {topic.current_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full ${
                            topic.passed_levels && topic.passed_levels.includes(level)
                              ? 'bg-green-500'
                              : 'bg-slate-200'
                          }`}
                          title={`Level ${level}${topic.passed_levels && topic.passed_levels.includes(level) ? ' - Completed' : ''}`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {topic.passed_levels && topic.passed_levels.length > 0
                        ? `Completed: Levels ${topic.passed_levels.join(', ')}`
                        : 'No levels completed yet'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden h-fit">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><FileText size={15} /> Submission History</h2>
            <span className="text-xs font-bold text-slate-500">{scores.length} submissions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {scores.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">No submissions yet. Start practicing to build your progress history.</div>
            ) : (
              scores.slice(0, 10).map((score) => (
                <div key={score.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{score.module_name}</p>
                      <p className="text-xs text-slate-500 mt-1">{score.module_type} · {new Date(score.completed_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">
                      {Number(score.overall_score || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
