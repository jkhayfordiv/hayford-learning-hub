import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';

export default function SubmissionReviewModal({ submission, onClose, onSaveComment }) {
  const [comment, setComment] = useState(submission.teacher_comment || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveComment = async () => {
    if (!comment.trim()) {
      setSaveError('Please enter a comment before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      await onSaveComment(submission.id, comment);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setSaveError(error.message || 'Failed to save comment. Please try again.');
      setIsSaving(false);
    }
  };

  // Parse AI feedback
  let aiFeedback = null;
  try {
    aiFeedback = typeof submission.ai_feedback === 'string' 
      ? JSON.parse(submission.ai_feedback) 
      : submission.ai_feedback;
  } catch (e) {
    console.error('Failed to parse AI feedback:', e);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Submission Review
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {submission.student_first_name} {submission.student_last_name} · {submission.module_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Score Display */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg">
              <span className="text-3xl font-black">{Number(submission.overall_score).toFixed(1)}</span>
              <span className="text-xs uppercase font-bold tracking-widest">Band Score</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Overall Performance</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Completed on {new Date(submission.completed_at).toLocaleString()}
              </p>
              {submission.word_count && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Word Count: {submission.word_count} words
                </p>
              )}
            </div>
          </div>

          {/* AI Feedback */}
          {aiFeedback && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} /> AI Feedback
              </h3>
              
              {/* IELTS Writing Feedback */}
              {aiFeedback.bandScore && (
                <div className="space-y-4">
                  {aiFeedback.modelHighlights && (
                    <p className="text-slate-700 dark:text-slate-300 italic border-l-4 border-indigo-500 pl-4">
                      "{aiFeedback.modelHighlights}"
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {aiFeedback.taskAchievement && (
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Task Achievement:</span>
                        <span className="text-slate-600 dark:text-slate-400 ml-2">{aiFeedback.taskAchievement}</span>
                      </div>
                    )}
                    {aiFeedback.coherenceCohesion && (
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Coherence:</span>
                        <span className="text-slate-600 dark:text-slate-400 ml-2">{aiFeedback.coherenceCohesion}</span>
                      </div>
                    )}
                    {aiFeedback.lexicalResource && (
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Lexical:</span>
                        <span className="text-slate-600 dark:text-slate-400 ml-2">{aiFeedback.lexicalResource}</span>
                      </div>
                    )}
                    {aiFeedback.grammarAccuracy && (
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Grammar:</span>
                        <span className="text-slate-600 dark:text-slate-400 ml-2">{aiFeedback.grammarAccuracy}</span>
                      </div>
                    )}
                  </div>

                  {aiFeedback.improvementTips && aiFeedback.improvementTips.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">Improvement Tips:</span>
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        {aiFeedback.improvementTips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Vocabulary Feedback */}
              {Array.isArray(aiFeedback) && (
                <div className="space-y-3">
                  {aiFeedback.map((item, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-indigo-900 dark:text-indigo-400">{item.word || 'Unknown Word'}</div>
                      <div className="text-slate-600 dark:text-slate-300 italic text-sm mt-1">"{item.sentence || 'No sentence'}"</div>
                      {item.feedback?.explanation && (
                        <div className="text-slate-500 dark:text-slate-400 text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          💡 {item.feedback.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Teacher Comment Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 border-amber-200 dark:border-amber-900">
            <h3 className="font-black text-sm uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-4 flex items-center gap-2">
              <MessageSquare size={16} /> Your Feedback to Student
            </h3>
            
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write your personalized feedback for this student..."
              rows={6}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
            />

            {saveError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                <AlertCircle size={16} />
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-bold rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
                <CheckCircle2 size={16} />
                Comment saved successfully!
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This comment will be visible to the student on their dashboard.
              </p>
              <button
                onClick={handleSaveComment}
                disabled={isSaving || saveSuccess}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
