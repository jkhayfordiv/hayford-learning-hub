import { useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

/**
 * ErrorCorrection
 *
 * Props:
 *   prompt       - instruction string
 *   questions    - array of { question, correct_answer } (10 items from engine)
 *   onSubmit     - fn(userResponse, activityType)
 *   status       - 'idle' | 'loading' | 'failed'
 *   feedbackMessage - string shown on failure
 *   showFeedback - boolean (true after submit)
 *   reviewResults - { results: bool[], correctAnswers: string[] }
 */
export default function ErrorCorrection({ prompt, questions = [], onSubmit, status, feedbackMessage, showFeedback, reviewResults }) {
  // userCorrections: { [questionIndex]: string }
  const [userCorrections, setUserCorrections] = useState({});

  const handleChange = (idx, value) => {
    setUserCorrections(prev => ({ ...prev, [idx]: value }));
  };

  const handleSubmit = () => {
    const corrections = questions.map((_, idx) => (userCorrections[idx] || '').trim());
    onSubmit({ corrections }, 'error_correction');
  };

  const allAnswered = questions.length > 0 &&
    questions.every((_, idx) => userCorrections[idx]?.trim());
  const isLoading = status === 'loading';
  const hasFailed = status === 'failed';

  return (
    <div>
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      <div className="space-y-6 mb-6">
        {questions.map((q, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4">
            <label className="block mb-3">
              <span className="font-semibold text-gray-800 block mb-2">
                {idx + 1}. {q.question}
              </span>
            </label>
            <input
              type="text"
              value={userCorrections[idx] || ''}
              onChange={e => handleChange(idx, e.target.value)}
              disabled={isLoading || showFeedback}
              placeholder="Type the correction here..."
              className={[
                'w-full px-4 py-3 rounded-xl border-2 transition-all',
                'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50',
                showFeedback
                  ? reviewResults?.results[idx]
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                  : 'border-gray-300 focus:border-brand-primary',
                isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white',
              ].join(' ')}
            />
            {showFeedback && !reviewResults?.results[idx] && (
              <p className="mt-2 text-sm text-green-700 font-medium">
                Correct answer: {reviewResults?.correctAnswers[idx]}
              </p>
            )}
          </div>
        ))}
      </div>

      {hasFailed && feedbackMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
          <p className="text-red-800">{feedbackMessage}</p>
        </div>
      )}

      <div className="flex justify-center">
        {!showFeedback && (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isLoading}
            className={[
              'px-12 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all',
              !allAnswered || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'text-white hover:shadow-xl',
            ].join(' ')}
            style={(!allAnswered || isLoading) ? {} : { background: 'var(--gw-brand-primary, #5E1914)' }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader className="animate-spin" size={20} />
                Submitting...
              </span>
            ) : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
}
