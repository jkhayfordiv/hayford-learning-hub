import { useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

export default function ErrorCorrection({ prompt, activityData, onSubmit, assessmentStatus, feedbackMessage }) {
  const [userCorrections, setUserCorrections] = useState({});
  const questions = activityData?.questions || activityData?.errors || [];

  const handleCorrectionChange = (errorIndex, value) => {
    setUserCorrections({
      ...userCorrections,
      [errorIndex]: value,
    });
  };

  const sanitizeInput = (input) => {
    return input.trim().toLowerCase();
  };

  const handleSubmit = () => {
    // Calculate score client-side with flexible validation
    let correctCount = 0;
    questions.forEach((q, idx) => {
      const userAnswer = sanitizeInput(userCorrections[idx] || '');
      // Handle both new 'correct_answer' and old 'accepted_corrections' formats
      const acceptedAnswers = q.correct_answer 
        ? [sanitizeInput(q.correct_answer)]
        : (q.accepted_corrections || []).map(ans => sanitizeInput(ans));
      
      if (acceptedAnswers.includes(userAnswer)) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 80;

    // Convert userCorrections object to array for backend
    const corrections = questions.map((_, idx) => userCorrections[idx] || '');

    // Submit to backend
    onSubmit({ corrections, score, passed }, 'error_correction');
  };

  const allAnswered = questions.length > 0 && questions.every((_, idx) => userCorrections[idx]?.trim());
  const isLoading = assessmentStatus === 'loading';
  const hasFailed = assessmentStatus === 'failed';

  return (
    <div>
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      {activityData?.sentence && (
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Find and Fix the Mistakes:</h3>
          <p className="text-gray-700 leading-relaxed font-mono text-sm whitespace-pre-line">
            {activityData.sentence}
          </p>
        </div>
      )}

      <div className="space-y-6 mb-6">
        {questions.map((q, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4">
            <label className="block mb-2">
              <span className="font-semibold text-gray-800 mb-2 block">
                {idx + 1}. {q.question}
              </span>
              {q.incorrect_word && (
                <span className="text-sm text-gray-600 italic">
                  Mistake: Fix "{q.incorrect_word}"
                </span>
              )}
            </label>
            <input
              type="text"
              value={userCorrections[idx] || ''}
              onChange={(e) => handleCorrectionChange(idx, e.target.value)}
              disabled={isLoading}
              placeholder="Write the correct word..."
              className={`
                w-full px-4 py-3 rounded-xl border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50
                ${isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                border-gray-300 focus:border-brand-primary
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
                : 'text-white hover:shadow-xl'
            }
          `}
          style={(!allAnswered || isLoading) ? {} : { background: 'var(--gw-brand-primary, #5E1914)' }}
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
