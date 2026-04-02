import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, BarChart3, FileText, ChevronDown } from 'lucide-react';
import SubmissionReviewModal from './components/SubmissionReviewModal';

const GRAMMAR_PRACTICE_SECTIONS = [
  {
    id: 'l1-interference',
    title: 'L1 Interference Fixes',
    topics: [
      { label: 'Article Usage', topicId: '01_article_usage' },
      { label: 'Countability & Plurals', topicId: '02_countability_and_plurals' },
      { label: 'Pronoun Reference', topicId: '03_pronoun_reference' },
      { label: 'Prepositional Accuracy', topicId: '04_prepositional_accuracy' },
      { label: 'Word Forms', topicId: '05_word_forms' },
    ],
  },
  {
    id: 'academic-foundations',
    title: 'Academic Foundations',
    topics: [
      { label: 'Subject-Verb Agreement', topicId: '06_subject_verb_agreement' },
      { label: 'Tense Consistency', topicId: '07_tense_consistency' },
      { label: 'Present Perfect vs. Past Simple', topicId: '08_present_perfect_vs_past_simple' },
      { label: 'Gerunds vs. Infinitives', topicId: '09_gerunds_vs_infinitives' },
      { label: 'Passive Voice Construction', topicId: '10_passive_voice_construction' },
    ],
  },
  {
    id: 'sentence-complexity',
    title: 'Sentence Complexity',
    topics: [
      { label: 'Sentence Boundaries (Fragments/Comma Splices)', topicId: '11_sentence_boundaries' },
      { label: 'Relative Clauses', topicId: '12_relative_clauses' },
      { label: 'Subordination', topicId: '13_subordination' },
      { label: 'Word Order', topicId: '14_word_order' },
      { label: 'Parallel Structure', topicId: '15_parallel_structure' },
    ],
  },
  {
    id: 'cohesion-register',
    title: 'Cohesion & Register',
    topics: [
      { label: 'Transitional Devices', topicId: '16_transitional_devices' },
      { label: 'Collocations', topicId: '17_collocations' },
      { label: 'Academic Register', topicId: '18_academic_register' },
      { label: 'Nominalization', topicId: '19_nominalization' },
      { label: 'Hedging', topicId: '20_hedging' },
    ],
  },
];

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function formatFeedbackBlocks(feedback) {
  if (!feedback) return [];

  if (typeof feedback === 'string') {
    return [{ label: 'Feedback', text: feedback }];
  }

  if (Array.isArray(feedback)) {
    return feedback
      .map((entry, idx) => {
        if (!entry) return null;
        if (typeof entry === 'string') return { label: `Point ${idx + 1}`, text: entry };
        if (typeof entry === 'object') {
          return {
            label: entry.word ? `Word: ${entry.word}` : `Item ${idx + 1}`,
            text: entry.feedback?.explanation || entry.explanation || JSON.stringify(entry),
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (typeof feedback === 'object') {
    const ordered = [
      ['bandScore', 'Band Score'],
      ['taskAchievement', 'Task Achievement'],
      ['coherenceCohesion', 'Coherence & Cohesion'],
      ['lexicalResource', 'Lexical Resource'],
      ['grammarAccuracy', 'Grammar Accuracy'],
      ['modelHighlights', 'Highlights'],
    ];

    const blocks = ordered
      .filter(([key]) => feedback[key] !== undefined && feedback[key] !== null && feedback[key] !== '')
      .map(([key, label]) => ({ label, text: String(feedback[key]) }));

    if (Array.isArray(feedback.improvementTips) && feedback.improvementTips.length > 0) {
      blocks.push({
        label: 'Improvement Tips',
        text: feedback.improvementTips.map((tip, idx) => `${idx + 1}. ${tip}`).join('\n'),
      });
    }

    if (blocks.length > 0) return blocks;
    return [{ label: 'Feedback', text: JSON.stringify(feedback, null, 2) }];
  }

  return [{ label: 'Feedback', text: String(feedback) }];
}

function derivePassedLevels(entry) {
  if (Array.isArray(entry?.passed_levels) && entry.passed_levels.length > 0) {
    return entry.passed_levels
      .map((level) => Number(level))
      .filter((level) => Number.isInteger(level) && level >= 1 && level <= 4)
      .sort((a, b) => a - b);
  }

  const unlocked = Number(entry?.current_level || 1);
  if (!Number.isInteger(unlocked) || unlocked <= 1) return [];
  return Array.from({ length: Math.max(0, Math.min(4, unlocked - 1)) }, (_, idx) => idx + 1);
}

function getTopWeaknesses(submissions) {
  const counts = {};
  submissions.forEach((submission) => {
    const tags = parseMaybeJson(submission.diagnostic_data);
    if (!Array.isArray(tags)) return;
    tags.forEach((tag) => {
      if (!tag) return;
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
}

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

  const [studentData, setStudentData] = useState(null);
  const [studentWeaknesses, setStudentWeaknesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [grammarProgress, setGrammarProgress] = useState([]);
  const [grammarProgressError, setGrammarProgressError] = useState('');
  const [isGrammarAssignModalOpen, setIsGrammarAssignModalOpen] = useState(false);
  const [selectedGrammarTopic, setSelectedGrammarTopic] = useState(null);
  const [expandedGrammarSections, setExpandedGrammarSections] = useState(
    GRAMMAR_PRACTICE_SECTIONS.map((section) => section.id)
  );
  const [grammarAssignStatus, setGrammarAssignStatus] = useState({ loading: false, error: null, success: false });

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_) {
      return {};
    }
  }, []);
  const canAssignGrammar = currentUser.role === 'teacher' || currentUser.role === 'admin';

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        setIsLoading(true);
        setError('');
        setGrammarProgressError('');
        const token = localStorage.getItem('token');
        const [scoresRes, grammarRes, weaknessesRes] = await Promise.all([
          fetch(`${apiBase}/api/scores/student/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBase}/api/grammar-progress/student/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBase}/api/users/${id}/weaknesses`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const data = await scoresRes.json();
        if (!scoresRes.ok) throw new Error(data.error || 'Failed to fetch student profile');
        setStudentData({
          ...data,
          submissions: (data.submissions || []).map((submission) => ({
            ...submission,
            ai_feedback: parseMaybeJson(submission.ai_feedback),
            diagnostic_data: parseMaybeJson(submission.diagnostic_data),
          })),
        });

        if (weaknessesRes.ok) {
          const weaknessData = await weaknessesRes.json();
          setStudentWeaknesses((weaknessData || []).map(w => ({ tag: w.category, count: w.error_count })));
        }

        if (grammarRes.ok) {
          const grammarData = await grammarRes.json();
          setGrammarProgress(Array.isArray(grammarData.progress) ? grammarData.progress : []);
        } else {
          const grammarErrorData = await grammarRes.json().catch(() => ({}));
          setGrammarProgress([]);
          setGrammarProgressError(grammarErrorData.error || 'Unable to load grammar progress.');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch student profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentProfile();
  }, [id, apiBase]);

  const topWeaknesses = studentWeaknesses;
  const passedGrammarTopics = useMemo(() => {
    return (grammarProgress || [])
      .map((entry) => ({
        topic: entry.error_category,
        passedLevels: derivePassedLevels(entry),
      }))
      .filter((entry) => entry.passedLevels.length > 0)
      .sort((a, b) => a.topic.localeCompare(b.topic));
  }, [grammarProgress]);

  const toggleGrammarSection = (sectionId) => {
    setExpandedGrammarSections((prev) => (
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    ));
  };

  const openGrammarAssignModal = () => {
    setSelectedGrammarTopic(null);
    setGrammarAssignStatus({ loading: false, error: null, success: false });
    setIsGrammarAssignModalOpen(true);
  };

  const handleSaveTeacherComment = async (scoreId, comment) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/api/scores/${scoreId}/comment`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teacher_comment: comment })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save comment');

    // Update local state
    setStudentData(prev => ({
      ...prev,
      submissions: prev.submissions.map(sub => 
        sub.id === scoreId ? { ...sub, teacher_comment: comment, feedback_date: new Date().toISOString() } : sub
      )
    }));

    return data;
  };

  const handleAssignGrammarPractice = async () => {
    if (!selectedGrammarTopic) return;

    setGrammarAssignStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const payload = {
        student_id: Number(id),
        assignment_type: 'grammar-practice',
        grammar_topic_id: selectedGrammarTopic.topicId,
        instructions: `Grammar Practice: ${selectedGrammarTopic.label}`,
      };

      const res = await fetch(`${apiBase}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign grammar practice');

      setGrammarAssignStatus({ loading: false, error: null, success: true });
      setTimeout(() => {
        setIsGrammarAssignModalOpen(false);
        setSelectedGrammarTopic(null);
        setGrammarAssignStatus({ loading: false, error: null, success: false });
      }, 900);
    } catch (err) {
      setGrammarAssignStatus({ loading: false, error: err.message || 'Failed to assign grammar practice', success: false });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading student profile...</div>;
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Unable to load student profile</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Unknown error occurred.'}</p>
          <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">{studentData.student.first_name} {studentData.student.last_name}</h1>
            <p className="text-xs font-bold text-slate-500 mt-1">{studentData.student.email}</p>
          </div>
        </div>
        {canAssignGrammar && (
          <button
            type="button"
            onClick={openGrammarAssignModal}
            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-900 hover:text-white px-4 py-2.5 rounded-xl border border-slate-200 transition-colors"
          >
            Assign Grammar Practice
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white border border-slate-200 rounded-3xl p-6 h-fit">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><BarChart3 size={16} /> Top Weaknesses</h2>
            {topWeaknesses.length === 0 ? (
              <p className="text-sm text-slate-500">No diagnostic tags yet.</p>
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
                        <div className="h-full bg-amber-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-6 h-fit">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Grammar Progress</h2>
            {grammarProgressError && <p className="text-xs text-red-600 mb-3">{grammarProgressError}</p>}
            {passedGrammarTopics.length === 0 ? (
              <p className="text-sm text-slate-500">No passed grammar levels yet.</p>
            ) : (
              <div className="space-y-3">
                {passedGrammarTopics.map((entry) => (
                  <div key={entry.topic} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{entry.topic}</p>
                    <p className="text-sm text-slate-600 mt-1">Passed: {entry.passedLevels.map((level) => `L${level}`).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><FileText size={15} /> Assignment History</h2>
            <span className="text-xs font-bold text-slate-500">{studentData.submissions.length} submissions</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[68vh] overflow-y-auto">
            {studentData.submissions.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">No submissions yet.</div>
            ) : (
              studentData.submissions.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubmission(submission);
                    setIsReviewModalOpen(true);
                  }}
                  className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{submission.module_name}</p>
                      <p className="text-xs text-slate-500 mt-1">{submission.module_type} · {new Date(submission.completed_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">
                      {Number(submission.overall_score || 0).toFixed(1)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </main>

      {isReviewModalOpen && selectedSubmission && (
        <SubmissionReviewModal
          submission={{
            ...selectedSubmission,
            student_first_name: studentData.student.first_name,
            student_last_name: studentData.student.last_name,
            grader_first_name: currentUser.first_name || 'Teacher'
          }}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedSubmission(null);
          }}
          onSaveComment={handleSaveTeacherComment}
        />
      )}

      {isGrammarAssignModalOpen && canAssignGrammar && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black text-2xl text-slate-900 tracking-tight">Assign Grammar Practice</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  {studentData.student.first_name} {studentData.student.last_name} · Choose a focused Grammar Lab topic.
                </p>
              </div>
              <button
                onClick={() => setIsGrammarAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                disabled={grammarAssignStatus.loading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              {grammarAssignStatus.error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
                  {grammarAssignStatus.error}
                </div>
              )}
              {grammarAssignStatus.success && (
                <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200">
                  Grammar practice assigned.
                </div>
              )}

              {GRAMMAR_PRACTICE_SECTIONS.map((section) => {
                const isExpanded = expandedGrammarSections.includes(section.id);
                return (
                  <div key={section.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGrammarSection(section.id)}
                      className="w-full px-5 py-4 bg-slate-50 text-left flex items-center justify-between"
                    >
                      <span className="font-black text-sm uppercase tracking-wide text-slate-700">{section.title}</span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white">
                        {section.topics.map((topic) => {
                          const isSelected = selectedGrammarTopic?.topicId === topic.topicId;
                          return (
                            <button
                              key={topic.topicId}
                              type="button"
                              onClick={() => setSelectedGrammarTopic(topic)}
                              className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                                isSelected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <p className="font-bold text-sm leading-tight">{topic.label}</p>
                              <p className={`text-[10px] uppercase tracking-widest mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                topicId: {topic.topicId}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-8 py-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 font-medium">
                {selectedGrammarTopic ? (
                  <span>Selected: <span className="font-bold text-slate-700">{selectedGrammarTopic.label}</span></span>
                ) : (
                  'Select one grammar topic to continue.'
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsGrammarAssignModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                  disabled={grammarAssignStatus.loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignGrammarPractice}
                  disabled={!selectedGrammarTopic || grammarAssignStatus.loading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-950 disabled:opacity-50"
                >
                  {grammarAssignStatus.loading ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
