import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Award, Sparkles, Loader2, Info } from 'lucide-react';
import { submitMasteryCheck, fetchReviewQuestions } from '../services/api';
import MultipleChoice from './mastery/MultipleChoice';
import ErrorCorrection from './mastery/ErrorCorrection';
import FillInTheBlank from './mastery/FillInTheBlank';
import AIGradedTextInput from './mastery/AIGradedTextInput';
import StandardMixed from './mastery/StandardMixed';
import Essay from './mastery/Essay';

// Pure Fisher-Yates shuffle — no bias, returns a new array
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build the final 10-question set from current bank + optional review pool.
// ALWAYS returns exactly min(10, currentBank.length) questions.
function buildQuiz(currentBank, reviewPool) {
  const QUIZ_SIZE = 10;

  // Determine how many review questions to inject (0–3), capped by pool size
  const maxReview = Math.min(3, reviewPool.length);
  const targetReview = maxReview > 0 ? Math.floor(Math.random() * maxReview) + 1 : 0;

  // Shuffle both pools independently
  const shuffledCurrent = shuffle(currentBank);
  const shuffledReview = shuffle(reviewPool);

  // Deduplicate review against current bank by question text
  const currentTexts = new Set(shuffledCurrent.map(q => q.question));
  const uniqueReview = shuffledReview.filter(q => !currentTexts.has(q.question));

  // Pick review questions first, then fill remainder from current bank
  const selectedReview = uniqueReview.slice(0, targetReview);
  const neededCurrent = QUIZ_SIZE - selectedReview.length;
  const selectedCurrent = shuffledCurrent.slice(0, neededCurrent);

  // Merge, do a final shuffle, and hard-cap at QUIZ_SIZE
  const final = shuffle([...selectedCurrent, ...selectedReview]).slice(0, QUIZ_SIZE);

  return { questions: final, reviewCount: selectedReview.length };
}

export default function MasteryCheckEngine({ node, regionName }) {
  // 'initializing' prevents ANY quiz render until math is complete
  const [status, setStatus] = useState('initializing');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [result, setResult] = useState(null);
  const [reviewResults, setReviewResults] = useState(null); // { results: bool[], correctAnswers: string[] }
  // quizData holds the FULL mastery_check object but with activity_data.questions
  // replaced by the 10-question subset
  const [quizData, setQuizData] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const navigate = useNavigate();

  const masteryCheck = node?.mastery_check;
  const rewards = node?.rewards;

  // ─── Quiz Initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (!masteryCheck) return;

    let cancelled = false; // guard against stale async closures

    const initializeQuiz = async () => {
      setStatus('initializing');
      setQuizData(null);

      // Fetch review pool — fail gracefully, never crash the quiz
      let reviewPool = [];
      try {
        const res = await fetchReviewQuestions();
        reviewPool = Array.isArray(res.questions) ? res.questions : [];
      } catch (err) {
        console.warn('[MasteryCheckEngine] Review fetch failed, using current node only:', err.message);
      }

      if (cancelled) return;

      // Essay type: bypass randomizer, pass through directly
      if (masteryCheck.type === 'essay') {
        if (cancelled) return;
        setQuizData(masteryCheck);
        setReviewCount(0);
        setStatus('idle');
        return;
      }

      const currentBank = Array.isArray(masteryCheck.activity_data?.questions)
        ? masteryCheck.activity_data.questions
        : [];

      if (currentBank.length === 0) {
        setStatus('failed');
        setFeedbackMessage('No questions found for this node. Please contact support.');
        return;
      }

      const { questions, reviewCount: rc } = buildQuiz(currentBank, reviewPool);

      if (cancelled) return;

      setQuizData({
        ...masteryCheck,
        activity_data: {
          ...masteryCheck.activity_data,
          questions, // exactly 10 (or fewer if bank is tiny)
        },
      });
      setReviewCount(rc);
      setStatus('idle');
    };

    initializeQuiz();

    return () => { cancelled = true; };
  }, [node?.node_id]); // only re-run when the actual node changes

  // ─── Submit Handler ────────────────────────────────────────────────────────
  const handleSubmit = async (userResponse, activityType) => {
    if (status === 'loading' || status === 'initializing') return;

    try {
      setStatus('loading');
      setFeedbackMessage('');

      const response = await submitMasteryCheck(
        node.node_id,
        activityType,
        userResponse,
        quizData,
      );

      setResult(response);
      setReviewResults({
        results: response.results,
        correctAnswers: response.correctAnswers
      });

      if (response.passed) {
        setFeedbackMessage(response.feedback || 'Excellent work! You can review your answers below before finishing.');
      } else {
        setFeedbackMessage(response.feedback || 'Please review your mistakes below and try again.');
      }
      
      // We set status to idle (or a new 'review' status) so the quiz stays visible
      setStatus('idle');
    } catch (error) {
      console.error('[MasteryCheckEngine] Submit error:', error);
      setStatus('failed');
      setFeedbackMessage('An error occurred. Please try again.');
    }
  };

  const handleReturnToMap = () => {
    const slug = regionName || 'time-matrix';
    navigate(`/region/${slug}`);
  };

  // ─── Render: Loading ───────────────────────────────────────────────────────
  if (status === 'initializing') {
    return (
      <div className="bg-white rounded-xl p-20 shadow-soft flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <Loader2 className="animate-spin text-brand-primary" size={64} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="text-brand-gold animate-pulse" size={24} />
          </div>
        </div>
        <p className="text-brand-navy font-bold text-xl mt-8 animate-pulse">Generating Lesson...</p>
        <p className="text-gray-400 text-sm mt-2">Mixing in past review questions...</p>
      </div>
    );
  }

  // ─── Render: No mastery check ──────────────────────────────────────────────
  if (!masteryCheck) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-soft text-center">
        <p className="text-gray-600">No mastery check available for this node.</p>
      </div>
    );
  }

  // ─── Render: Success ───────────────────────────────────────────────────────
  if (result?.passed && status === 'success') {
    return (
      <div className="bg-white rounded-xl p-8 shadow-soft border-4 border-brand-gold animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-brand-gold bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-subtle">
            <Trophy className="text-brand-gold" size={48} />
          </div>
          <h2 className="font-serif text-4xl text-brand-primary mb-3">Mastery Achieved!</h2>
          <p className="text-xl text-gray-700 mb-2">
            Score: <strong className="text-brand-gold">{result?.score}%</strong>
          </p>
        </div>

        <div className="bg-gradient-to-br from-brand-gold from-opacity-10 to-transparent rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="text-brand-gold" size={24} />
                <span className="text-3xl font-bold text-brand-primary">
                  +{rewards?.mastery_points || 100}
                </span>
              </div>
              <p className="text-sm text-gray-600">Mastery Points</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Award
                  className={
                    rewards?.medal_tier === 'Bronze' ? 'text-amber-600' :
                    rewards?.medal_tier === 'Silver' ? 'text-gray-400' :
                    rewards?.medal_tier === 'Gold'   ? 'text-brand-gold' : 'text-gray-400'
                  }
                  size={32}
                />
              </div>
              <p className="text-sm text-gray-600">{rewards?.medal_tier} Medal</p>
            </div>
          </div>
        </div>

        {result?.feedback && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Instructor Feedback</h3>
            <p className="text-blue-800 leading-relaxed whitespace-pre-line">{result.feedback}</p>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleReturnToMap}
            className="bg-brand-navy text-white px-10 py-4 rounded-xl hover:bg-opacity-90 transition-all font-semibold text-lg shadow-lg hover:shadow-xl flex items-center gap-3"
          >
            <Trophy size={24} />
            Return to World Map
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Quiz ──────────────────────────────────────────────────────────
  if (!quizData) {
    // Should not normally reach here, but acts as a safety net
    return (
      <div className="bg-white rounded-xl p-8 shadow-soft text-center">
        <p className="text-gray-600">Quiz data unavailable. Please refresh.</p>
      </div>
    );
  }

  const { type, prompt_to_student, activity_data, ai_grading_rubric } = quizData;

  // The 10-question array. Every child component receives this directly.
  const questions = activity_data?.questions || [];

  const commonProps = {
    prompt: prompt_to_student,
    questions,          // ← the single source of truth: always the 10-item subset
    onSubmit: handleSubmit,
    status,
    feedbackMessage,
    reviewResults,      // New: pass review data
    showFeedback: !!reviewResults // New: boolean flag
  };

  const renderQuizComponent = () => {
    switch (type) {
      case 'multiple_choice':
        return <MultipleChoice {...commonProps} />;
      case 'error_correction':
        return <ErrorCorrection {...commonProps} />;
      case 'fill_in_the_blank':
        return <FillInTheBlank {...commonProps} />;
      case 'ai_graded_text_input':
        return <AIGradedTextInput {...commonProps} aiRubric={ai_grading_rubric} />;
      case 'standard_mixed':
        return <StandardMixed {...commonProps} />;
      case 'essay':
        return <Essay {...commonProps} />;
      default:
        return (
          <div className="bg-white rounded-xl p-8 shadow-soft text-center">
            <p className="text-gray-600">Unknown assessment type: {type}</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl p-8 shadow-soft">
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-brand-primary mb-1">Mastery Check</h2>
        <p className="text-gray-500 text-sm">
          {questions.length} questions &mdash; Demonstrate your understanding to unlock the next node.
        </p>
      </div>

      {reviewCount > 0 && (
        <div className="bg-brand-navy border-l-4 border-brand-gold rounded-lg p-4 mb-6 flex items-center gap-3">
          <Info className="text-brand-gold flex-shrink-0" size={20} />
          <p className="text-white text-sm font-medium">
            Keep your eyes open!{' '}
            <span className="text-brand-gold font-bold">{reviewCount}</span> of these questions are
            review from past lessons.
          </p>
        </div>
      )}

      {renderQuizComponent()}

      {/* Continue button for passed quizzes */}
      {reviewResults && (
        <div className="mt-12 flex flex-col items-center border-t border-gray-100 pt-8">
          {result?.passed ? (
            <>
              <p className="text-brand-primary font-semibold mb-4 text-center">
                Great job! You passed with {result.score}%.
              </p>
              <button
                onClick={() => setStatus('success')}
                className="bg-brand-navy text-white px-12 py-4 rounded-xl hover:bg-opacity-90 transition-all font-semibold text-lg shadow-lg hover:shadow-xl flex items-center gap-3"
              >
                Finish & Claim Rewards
                <Trophy size={20} />
              </button>
            </>
          ) : (
            <>
              <p className="text-red-600 font-semibold mb-4 text-center">
                Score: {result?.score}% (80% required to pass)
              </p>
              <button
                onClick={() => {
                  setReviewResults(null);
                  setResult(null);
                  setFeedbackMessage('');
                  // Re-initialize might be needed or just let them try again
                }}
                className="bg-gray-800 text-white px-12 py-4 rounded-xl hover:bg-opacity-80 transition-all font-semibold text-lg shadow-lg hover:shadow-xl"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
