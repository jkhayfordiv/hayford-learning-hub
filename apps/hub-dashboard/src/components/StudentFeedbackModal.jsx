import React from 'react';
import { X, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

export default function StudentFeedbackModal({ score, onClose, onMarkAsRead }) {
  React.useEffect(() => {
    // Mark as read when modal opens
    if (score.teacher_comment && !score.teacher_comment_read) {
      onMarkAsRead(score.id);
    }
  }, [score.id, score.teacher_comment, score.teacher_comment_read, onMarkAsRead]);

  // Parse AI feedback
  let aiFeedback = null;
  try {
    aiFeedback = typeof score.ai_feedback === 'string' 
      ? JSON.parse(score.ai_feedback) 
      : score.ai_feedback;
  } catch (e) {
    console.error('Failed to parse AI feedback:', e);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Your Submission Results
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {score.module_name} · Completed {new Date(score.completed_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Score Display */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg">
              <span className="text-3xl font-black">{Number(score.overall_score).toFixed(1)}</span>
              <span className="text-xs uppercase font-bold tracking-widest">Band Score</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Great Work!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Keep practicing to improve your skills
              </p>
              {score.word_count && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Word Count: {score.word_count} words
                </p>
              )}
            </div>
          </div>

          {/* Teacher Comment - Most Prominent */}
          {score.teacher_comment && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-6 border-2 border-amber-300 dark:border-amber-700 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={20} className="text-amber-600 dark:text-amber-500" />
                <h3 className="font-black text-sm uppercase tracking-widest text-amber-700 dark:text-amber-500">
                  Personal Feedback from Your Teacher
                </h3>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {score.teacher_comment}
                </p>
              </div>
            </div>
          )}

          {/* AI Feedback */}
          {aiFeedback && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Sparkles size={16} /> AI Analysis
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

          {/* Your Answer */}
          {score.submitted_text && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 mb-4">
                Your Answer
              </h3>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-serif leading-relaxed italic">
                "{score.submitted_text}"
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 dark:bg-amber-600 hover:bg-slate-950 dark:hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
