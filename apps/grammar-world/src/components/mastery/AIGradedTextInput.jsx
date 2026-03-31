import { useState } from 'react';
import { Loader, AlertCircle, Sparkles } from 'lucide-react';

export default function AIGradedTextInput({ prompt, activityData, aiRubric, onSubmit, assessmentStatus, feedbackMessage }) {
  const [userText, setUserText] = useState('');

  const handleSubmit = () => {
    // For AI grading, we send the text to the server
    // The server will calculate the score and return feedback
    onSubmit({ userText }, 'ai_graded_text_input');
  };

  const hasText = userText.trim().length > 0;
  const isLoading = assessmentStatus === 'loading';
  const hasFailed = assessmentStatus === 'failed';

  return (
    <div>
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      <div className="mb-6">
        <label className="block mb-3">
          <span className="font-semibold text-gray-800">Your Response:</span>
        </label>
        <textarea
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          disabled={isLoading}
          placeholder="Write your response here..."
          rows={12}
          className={`
            w-full px-4 py-3 rounded-xl border-2 transition-all
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50
            ${isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            border-gray-300 focus:border-brand-primary
            font-sans text-gray-800 leading-relaxed
          `}
        />
        <p className="text-sm text-gray-500 mt-2">
          {userText.length} characters
        </p>
      </div>

      {isLoading && (
        <div className="border-2 border-brand-primary rounded-xl p-6 mb-6" style={{ background: 'rgba(var(--gw-brand-primary-rgb, 94,25,20), 0.05)' }}>
          <div className="flex items-center justify-center gap-3">
            <Loader className="animate-spin text-brand-primary" size={24} />
            <div>
              <p className="font-semibold text-brand-primary flex items-center gap-2">
                <Sparkles size={18} />
                Evaluating academic syntax...
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Our AI is analyzing your response for grammar, structure, and content quality.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasFailed && feedbackMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
          <div>
            <p className="text-red-800 font-semibold mb-1">Score Below Threshold</p>
            <p className="text-red-700 text-sm">{feedbackMessage}</p>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!hasText || isLoading}
          className={`
            px-12 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all
            ${
              !hasText || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'text-white hover:shadow-xl'
            }
          `}
          style={(!hasText || isLoading) ? {} : { background: 'var(--gw-brand-primary, #5E1914)' }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader className="animate-spin" size={20} />
              Evaluating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles size={20} />
              Submit for AI Grading
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
