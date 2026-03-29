import { useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

export default function FillInTheBlank({ prompt, activityData, onSubmit, assessmentStatus, feedbackMessage }) {
  const [userAnswers, setUserAnswers] = useState({});
  const blanks = activityData?.blanks || [];

  const handleAnswerChange = (blankIndex, value) => {
    setUserAnswers({
      ...userAnswers,
      [blankIndex]: value,
    });
  };

  const sanitizeInput = (input) => {
    return input.trim().toLowerCase();
  };

  const handleSubmit = () => {
    // Calculate score client-side with flexible validation
    let correctCount = 0;
    blanks.forEach((blank, idx) => {
      const userAnswer = sanitizeInput(userAnswers[idx] || '');
      const acceptedAnswers = blank.accepted_answers.map(ans => sanitizeInput(ans));
      
      if (acceptedAnswers.includes(userAnswer)) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / blanks.length) * 100);
    const passed = score >= 80;

    // Convert userAnswers object to array for backend
    const answers = blanks.map((_, idx) => userAnswers[idx] || '');

    // Submit to backend
    onSubmit({ answers, score, passed }, 'fill_in_the_blank');
  };

  const allAnswered = blanks.every((_, idx) => userAnswers[idx]?.trim());
  const isLoading = assessmentStatus === 'loading';
  const hasFailed = assessmentStatus === 'failed';

  return (
    <div>
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      <div className="space-y-6 mb-6">
        {blanks.map((blank, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4">
            <label className="block mb-3">
              <span className="font-semibold text-gray-800 mb-2 block">
                {idx + 1}. {blank.sentence_with_blank}
              </span>
              {blank.hint && (
                <span className="text-sm text-gray-600 italic">
                  Hint: {blank.hint}
                </span>
              )}
            </label>
            <input
              type="text"
              value={userAnswers[idx] || ''}
              onChange={(e) => handleAnswerChange(idx, e.target.value)}
              disabled={isLoading}
              placeholder="Write your answer here..."
              className={`
                w-full px-4 py-3 rounded-xl border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-brand-sangria focus:ring-opacity-50
                ${isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                border-gray-300 focus:border-brand-sangria
              `}
            />
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
            'Submit'
          )}
        </button>
      </div>
    </div>
  );
}
