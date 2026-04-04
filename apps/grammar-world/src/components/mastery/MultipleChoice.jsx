import { useState, useMemo } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

// Fisher-Yates shuffle (pure — returns new array)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * MultipleChoice
 *
 * Props:
 *   prompt       - instruction string shown above the questions
 *   questions    - array of { question, options[], correct_answer } (10 items from engine)
 *   onSubmit     - fn(userResponse, activityType)
 *   status       - 'idle' | 'loading' | 'failed'
 *   feedbackMessage - string shown on failure
 *   showFeedback - boolean (true after submit)
 *   reviewResults - { results: bool[], correctAnswers: string[] }
 */
export default function MultipleChoice({ prompt, questions = [], onSubmit, status, feedbackMessage, showFeedback, reviewResults }) {
  // Shuffle each question's options once on mount / when questions change
  const shuffledQuestions = useMemo(
    () => questions.map(q => ({ ...q, shuffledOptions: shuffle(q.options || []) })),
    [questions],
  );

  // selectedAnswers: { [questionIndex]: selectedOptionText }
  const [selectedAnswers, setSelectedAnswers] = useState({});

  const handleSelect = (qIdx, optionText) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optionText }));
  };

  const handleSubmit = () => {
    // Build answers array aligned to the original (shuffled) question order
    const answers = shuffledQuestions.map((_, idx) => selectedAnswers[idx] ?? null);
    onSubmit({ answers }, 'multiple_choice');
  };

  const allAnswered = shuffledQuestions.length > 0 &&
    shuffledQuestions.every((_, idx) => selectedAnswers[idx] != null);
  const isLoading = status === 'loading';
  const hasFailed = status === 'failed';

  return (
    <div>
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      <div className="space-y-8 mb-6">
        {shuffledQuestions.map((q, qIdx) => (
          <div key={qIdx} className="border-b border-gray-200 pb-6 last:border-b-0">
            <p className="font-semibold text-gray-800 mb-4">
              {qIdx + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.shuffledOptions.map((option, oIdx) => (
                <button
                  key={oIdx}
                  onClick={() => !showFeedback && handleSelect(qIdx, option)}
                  disabled={isLoading || showFeedback}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                    // Feedback styling
                    showFeedback
                      ? selectedAnswers[qIdx] === option
                        ? (reviewResults?.results[qIdx] 
                            ? 'border-green-500 bg-green-50 font-semibold' // Correct Choice
                            : 'border-red-500 bg-red-50' // Incorrect Choice
                          )
                        : (option === reviewResults?.correctAnswers[qIdx]
                            ? 'border-green-500 border-dashed bg-white font-semibold' // Highlight Correct Answer if missed
                            : 'border-gray-100 opacity-60'
                          )
                      // Choice styling
                      : selectedAnswers[qIdx] === option
                        ? 'border-brand-primary bg-brand-primary/5 font-semibold'
                        : 'border-gray-200 hover:border-brand-primary hover:bg-gray-50',
                    
                    isLoading || showFeedback ? 'cursor-default' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <span className="inline-block w-6 mr-2 font-mono text-gray-500">
                    {String.fromCharCode(65 + oIdx)}.
                  </span>
                  {option}
                  {showFeedback && selectedAnswers[qIdx] === option && (
                    <span className="float-right font-bold text-sm">
                      {reviewResults?.results[qIdx] ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
            ) : (
              `Submit (${Object.keys(selectedAnswers).length}/${shuffledQuestions.length} answered)`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
