import { useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

export default function MultipleChoice({ prompt, activityData, onSubmit, assessmentStatus, feedbackMessage }) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const questions = activityData?.questions || [];

  const handleAnswerSelect = (questionIndex, optionText) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: optionText,
    });
  };

  const handleSubmit = () => {
    // Calculate score client-side
    let correctCount = 0;
    questions.forEach((question, idx) => {
      if (selectedAnswers[idx] === question.correct_answer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 80;

    // Submit to backend
    onSubmit({ selectedAnswers, score, passed }, 'multiple_choice');
  };

  const allAnswered = questions.every((_, idx) => selectedAnswers[idx] !== undefined);
  const isLoading = assessmentStatus === 'loading';
  const hasFailed = assessmentStatus === 'failed';

  return (
    <div>
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      <div className="space-y-8 mb-6">
        {questions.map((question, qIdx) => (
          <div key={qIdx} className="border-b border-gray-200 pb-6 last:border-b-0">
            <p className="font-semibold text-gray-800 mb-4">
              {qIdx + 1}. {question.question}
            </p>
            <div className="space-y-2">
              {question.options.map((option, oIdx) => (
                <button
                  key={oIdx}
                  onClick={() => handleAnswerSelect(qIdx, option)}
                  disabled={isLoading}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                    ${
                      selectedAnswers[qIdx] === option
                        ? 'border-brand-sangria bg-brand-sangria bg-opacity-5 font-semibold'
                        : 'border-gray-200 hover:border-brand-sangria hover:bg-gray-50'
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span className="inline-block w-6 mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                  {option}
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
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || isLoading}
          className={`
            px-12 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all
            ${
              !allAnswered || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-brand-sangria text-white hover:bg-opacity-90 hover:shadow-xl'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader className="animate-spin" size={20} />
              Submitting...
            </span>
          ) : (
            'Submit Answers'
          )}
        </button>
      </div>
    </div>
  );
}
