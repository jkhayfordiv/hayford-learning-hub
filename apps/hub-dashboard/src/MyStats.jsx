import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, BarChart3, FileText } from 'lucide-react';

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
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
}

export default function MyStats() {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

  const [scores, setScores] = useState([]);
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

    fetchMyScores();
  }, [apiBase]);

  const topWeaknesses = useMemo(() => aggregateWeaknesses(scores), [scores]);

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
        <section className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 h-fit">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><BarChart3 size={16} /> Top Weaknesses</h2>
          {topWeaknesses.length === 0 ? (
            <p className="text-sm text-slate-500">No diagnostic data yet. Complete more submissions to unlock insights.</p>
          ) : (
            <div className="space-y-3">
              {topWeaknesses.map((item) => {
                const maxCount = topWeaknesses[0]?.count || 1;
                const width = Math.max(15, (item.count / maxCount) * 100);
                return (
                  <div key={item.tag}>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>{item.tag}</span>
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

        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><FileText size={15} /> Submission History</h2>
            <span className="text-xs font-bold text-slate-500">{scores.length} submissions</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[68vh] overflow-y-auto">
            {scores.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">No submissions yet. Start practicing to build your progress history.</div>
            ) : (
              scores.map((score) => (
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
