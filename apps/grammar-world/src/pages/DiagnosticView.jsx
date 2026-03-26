import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { fetchNode, submitMasteryCheck } from '../services/api';

export default function DiagnosticView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diagnosticNode, setDiagnosticNode] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDiagnostic();
  }, []);

  const loadDiagnostic = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchNode('node-0-diagnostic');
      setDiagnosticNode(data);
    } catch (err) {
      console.error('Error loading diagnostic:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: optionIndex,
    });
  };

  const handleSubmit = async () => {
    if (!diagnosticNode) return;

    const questions = diagnosticNode.content_json.mastery_check.activity_data.questions;
    const allAnswered = questions.every((_, idx) => selectedAnswers[idx] !== undefined);

    if (!allAnswered) {
      alert('Please answer all questions before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await submitMasteryCheck(
        'node-0-diagnostic',
        'multiple_choice',
        selectedAnswers,
        diagnosticNode.content_json.mastery_check
      );
      setResult(response);

      // Wait 3 seconds to show results, then navigate to hub
      setTimeout(() => {
        navigate('/hub');
      }, 3000);
    } catch (err) {
      console.error('Error submitting diagnostic:', err);
      alert('Failed to submit diagnostic. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-sangria border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Diagnostic Assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md shadow-soft">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="font-serif text-2xl text-brand-sangria mb-2 text-center">Error Loading Diagnostic</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={loadDiagnostic}
            className="w-full bg-brand-sangria text-white px-6 py-3 rounded-xl hover:bg-opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md shadow-soft text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={64} />
          <h2 className="font-serif text-3xl text-brand-sangria mb-4">Diagnostic Complete!</h2>
          <p className="text-gray-600 text-lg mb-2">
            Score: <strong>{result.score}%</strong>
          </p>
          <p className="text-gray-600 mb-6">
            {result.passed ? 'You passed the diagnostic!' : 'Keep practicing!'}
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to your personalized pathway...
          </p>
        </div>
      </div>
    );
  }

  const questions = diagnosticNode?.content_json?.mastery_check?.activity_data?.questions || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-brand-sangria to-brand-navy text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={32} />
            <h1 className="font-serif text-3xl md:text-4xl">The Gatekeeper Assessment</h1>
          </div>
          <p className="text-gray-200">Diagnostic Evaluation</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Lesson Content */}
        <div className="bg-white rounded-xl p-8 shadow-soft mb-8">
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="font-serif text-4xl text-brand-sangria mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="font-serif text-3xl text-brand-sangria mb-3 mt-6">{children}</h2>,
                h3: ({ children }) => <h3 className="font-serif text-2xl text-brand-navy mb-2 mt-4">{children}</h3>,
                p: ({ children }) => <p className="font-sans text-gray-700 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="font-sans text-gray-700 mb-4 ml-6 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="font-sans text-gray-700 mb-4 ml-6 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-2">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-brand-sangria">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {diagnosticNode?.content_json?.lesson_content_markdown || ''}
            </ReactMarkdown>
          </div>
        </div>

        {/* Multiple Choice Questions */}
        <div className="bg-white rounded-xl p-8 shadow-soft mb-8">
          <h2 className="font-serif text-2xl text-brand-sangria mb-6">Assessment Questions</h2>
          <div className="space-y-8">
            {questions.map((question, qIdx) => (
              <div key={qIdx} className="border-b border-gray-200 pb-6 last:border-b-0">
                <p className="font-semibold text-gray-800 mb-4">
                  {qIdx + 1}. {question.question}
                </p>
                <div className="space-y-2">
                  {question.options.map((option, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => handleAnswerSelect(qIdx, oIdx)}
                      className={`
                        w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                        ${
                          selectedAnswers[qIdx] === oIdx
                            ? 'border-brand-sangria bg-brand-sangria bg-opacity-5 font-semibold'
                            : 'border-gray-200 hover:border-brand-sangria hover:bg-gray-50'
                        }
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
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(selectedAnswers).length !== questions.length}
            className={`
              px-12 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all
              ${
                submitting || Object.keys(selectedAnswers).length !== questions.length
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-brand-sangria text-white hover:bg-opacity-90 hover:shadow-xl'
              }
            `}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader className="animate-spin" size={20} />
                Submitting...
              </span>
            ) : (
              'Submit Diagnostic'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
