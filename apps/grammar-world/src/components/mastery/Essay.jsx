import { useState } from 'react';
import { Loader, AlertCircle, BookOpen, CheckCircle } from 'lucide-react';

/**
 * Essay
 *
 * Props:
 *   prompt         - instruction string shown above the chart
 *   questions      - array with a single item: { chart_description, rubric, min_words }
 *   onSubmit       - fn(userResponse, activityType)
 *   status         - 'idle' | 'loading' | 'failed'
 *   feedbackMessage - string shown after submit
 *   showFeedback   - boolean (true after submit)
 *   reviewResults  - { results: bool[], correctAnswers: string[] } (not used for essays, but passed for API compat)
 */
export default function Essay({ prompt, questions = [], onSubmit, status, feedbackMessage, showFeedback }) {
  const [essayText, setEssayText] = useState('');
  const chartQuestion = questions[0] || {};
  const { chart_description, min_words = 40 } = chartQuestion;

  const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
  const hasEnoughWords = wordCount >= min_words;
  const isLoading = status === 'loading';
  const hasFailed = status === 'failed';

  const handleSubmit = () => {
    onSubmit({ text: essayText }, 'essay');
  };

  return (
    <div className="essay-assessment">
      {prompt && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-8">
          <p className="text-blue-900 font-medium">{prompt}</p>
        </div>
      )}

      {/* Data Chart Display */}
      {chart_description && (
        <div className="bg-brand-navy rounded-2xl p-6 mb-8 border border-brand-gold/20">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="text-brand-gold flex-shrink-0" size={22} />
            <h3 className="text-brand-gold font-bold text-lg uppercase tracking-wide">Data Chart</h3>
          </div>
          <pre className="text-white text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {chart_description}
          </pre>
        </div>
      )}

      {/* Essay Textarea */}
      {!showFeedback && (
        <div className="mb-6">
          <label className="block mb-3">
            <span className="font-semibold text-gray-700 text-base">Your Academic Paragraph:</span>
          </label>
          <textarea
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            disabled={isLoading}
            placeholder="Begin your academic paragraph here. Remember to include a Present Perfect structure, a Past Perfect structure, and a Passive Voice structure..."
            rows={8}
            className={`w-full px-5 py-4 rounded-2xl border-2 resize-y text-gray-800 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all ${
              isLoading
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                : 'bg-white border-gray-300 focus:border-brand-primary'
            }`}
          />
          <div className={`mt-2 text-sm font-medium flex items-center gap-2 ${hasEnoughWords ? 'text-green-600' : 'text-gray-400'}`}>
            {hasEnoughWords && <CheckCircle size={16} />}
            <span>{wordCount} / {min_words} words minimum</span>
          </div>
        </div>
      )}

      {/* Show submitted essay in read-only mode after submission */}
      {showFeedback && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
          <h4 className="font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3">Your Submitted Paragraph:</h4>
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{essayText}</p>
        </div>
      )}

      {/* AI Feedback Banner */}
      {showFeedback && feedbackMessage && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">AI Instructor Feedback:</h3>
          <p className="text-blue-800 leading-relaxed whitespace-pre-line">{feedbackMessage}</p>
        </div>
      )}

      {/* Error Banner */}
      {hasFailed && feedbackMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
          <p className="text-red-800">{feedbackMessage}</p>
        </div>
      )}

      {!showFeedback && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleSubmit}
            disabled={!hasEnoughWords || isLoading}
            className={`px-16 py-5 rounded-2xl font-bold text-xl shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 ${
              !hasEnoughWords || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-brand-navy text-white hover:bg-opacity-95'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-3">
                <Loader className="animate-spin" size={24} />
                AI is grading your defense...
              </span>
            ) : (
              'Submit for AI Grading'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
