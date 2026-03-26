import { useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

export default function ErrorCorrection({ prompt, activityData, onSubmit, assessmentStatus, feedbackMessage }) {
  const [userCorrections, setUserCorrections] = useState({});
  const errors = activityData?.errors || [];

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
    errors.forEach((error, idx) => {
      const userAnswer = sanitizeInput(userCorrections[idx] || '');
      const acceptedAnswers = error.accepted_corrections.map(ans => sanitizeInput(ans));
      
      if (acceptedAnswers.includes(userAnswer)) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / errors.length) * 100);
    const passed = score >= 80;

    // Submit to backend
    onSubmit({ userCorrections, score, passed }, 'error_correction');
  };

  const allAnswered = errors.every((_, idx) => userCorrections[idx]?.trim());
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
        {errors.map((error, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4">
            <label className="block mb-2">
              <span className="font-semibold text-gray-800">
                Mistake {idx + 1}: Fix "{error.incorrect_word}"
              </span>
            </label>
            <input
              type="text"
              value={userCorrections[idx] || ''}
              onChange={(e) => handleCorrectionChange(idx, e.target.value)}
              disabled={isLoading}
              placeholder="Write the correct word..."
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
