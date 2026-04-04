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
 * StandardMixed Component
 * 
 * A unified component that handles Multiple Choice, Fill in the Blank, 
 * and Error Correction question types in a single assessment list.
 */
export default function StandardMixed({ prompt, questions = [], onSubmit, status, feedbackMessage, showFeedback, reviewResults }) {
  
  // 1. Memoize shuffled options for MC questions so they don't jump around on re-renders
  const processedQuestions = useMemo(() => {
    return questions.map(q => {
      if (q.type === 'multiple_choice' && q.options) {
        return { ...q, shuffledOptions: shuffle(q.options) };
      }
      return q;
    });
  }, [questions]);

  // 2. Local state for all answers (keyed by question index)
  const [userAnswers, setUserAnswers] = useState({});

  const handleInputChange = (idx, value) => {
    if (showFeedback) return;
    setUserAnswers(prev => ({ ...prev, [idx]: value }));
  };

  const handleSubmit = () => {
    // Unify all answers into a single array for the backend
    const answers = processedQuestions.map((_, idx) => userAnswers[idx] || '');
    onSubmit({ answers }, 'standard_mixed');
  };

  const isLoading = status === 'loading';
  const hasFailed = status === 'failed';
  
  // Check completion: all questions must have a non-empty string in userAnswers
  const allAnswered = processedQuestions.length > 0 && 
    processedQuestions.every((_, idx) => {
      const val = userAnswers[idx];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

  return (
    <div className="standard-mixed-assessment">
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-8">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      <div className="space-y-10 mb-8">
        {processedQuestions.map((q, idx) => {
          const isCorrect = reviewResults?.results?.[idx];
          const feedbackClass = showFeedback 
            ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') 
            : 'border-gray-200';

          return (
            <div key={idx} className={`p-6 rounded-2xl border-2 transition-all ${feedbackClass}`}>
              <div className="flex items-start gap-4 mb-4">
                <span className="flex-shrink-0 w-8 h-8 bg-brand-navy text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </span>
                <p className="font-semibold text-gray-800 text-lg pt-0.5">
                  {q.question}
                </p>
              </div>

              {/* Multiple Choice Rendering */}
              {q.type === 'multiple_choice' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-12">
                  {q.shuffledOptions.map((option, oIdx) => {
                    const isSelected = userAnswers[idx] === option;
                    const isCorrectAnswer = option === reviewResults?.correctAnswers?.[idx];
                    
                    let btnClass = 'w-full text-left px-4 py-3 rounded-xl border-2 transition-all ';
                    if (showFeedback) {
                      if (isSelected) {
                        btnClass += isCorrect ? 'border-green-500 bg-green-100' : 'border-red-500 bg-red-100';
                      } else if (isCorrectAnswer) {
                        btnClass += 'border-green-500 border-dashed bg-white font-bold';
                      } else {
                        btnClass += 'border-gray-100 opacity-50';
                      }
                    } else {
                      btnClass += isSelected 
                        ? 'border-brand-primary bg-brand-primary/5 font-semibold' 
                        : 'border-gray-200 hover:border-brand-primary hover:bg-gray-50';
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={isLoading || showFeedback}
                        onClick={() => handleInputChange(idx, option)}
                        className={btnClass}
                      >
                        <span className="mr-2 text-gray-400 font-mono italic">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Fill in the Blank / Error Correction Rendering (Unified text input) */}
              {(q.type === 'fill_in_the_blank' || q.type === 'error_correction') && (
                <div className="ml-12">
                  <input
                    type="text"
                    value={userAnswers[idx] || ''}
                    onChange={(e) => handleInputChange(idx, e.target.value)}
                    disabled={isLoading || showFeedback}
                    placeholder={q.type === 'error_correction' ? "Type the correction..." : "Type your answer..."}
                    className={`w-full max-w-lg px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all ${
                      showFeedback 
                        ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                        : 'border-gray-300 focus:border-brand-primary'
                    }`}
                  />
                  {showFeedback && !isCorrect && (
                    <div className="mt-3 flex items-center gap-2 text-green-700 font-bold">
                      <span>✓ Correct Answer:</span>
                      <span className="bg-green-100 px-3 py-1 rounded-lg">
                        {reviewResults?.correctAnswers?.[idx]}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasFailed && feedbackMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
          <p className="text-red-800">{feedbackMessage}</p>
        </div>
      )}

      {!showFeedback && (
        <div className="flex justify-center mt-12 pb-12">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isLoading}
            className={`px-16 py-5 rounded-2xl font-bold text-xl shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 ${
              !allAnswered || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed scale-95'
                : 'bg-brand-navy text-white hover:bg-opacity-95'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-3">
                <Loader className="animate-spin" size={24} />
                Analyzing Results...
              </span>
            ) : (
              `Submit Defense (${Object.keys(userAnswers).length}/${processedQuestions.length} answered)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
