import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Award, Sparkles, Loader2, Info } from 'lucide-react';
import { submitMasteryCheck, fetchReviewQuestions } from '../services/api';
import MultipleChoice from './mastery/MultipleChoice';
import ErrorCorrection from './mastery/ErrorCorrection';
import FillInTheBlank from './mastery/FillInTheBlank';
import AIGradedTextInput from './mastery/AIGradedTextInput';

export default function MasteryCheckEngine({ node, regionName }) {
  const [assessmentStatus, setAssessmentStatus] = useState('idle'); // idle, initializing, loading, success, failed
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [result, setResult] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const navigate = useNavigate();

  const masteryCheck = node?.mastery_check;
  const rewards = node?.rewards;

  // Spaced Repetition Logic - Initialize Quiz
  useEffect(() => {
    if (!masteryCheck || assessmentStatus !== 'idle') return;

    const initializeQuiz = async () => {
      try {
        setAssessmentStatus('initializing');
        
        // Fetch potential review questions
        let reviewPool = [];
        try {
          const res = await fetchReviewQuestions();
          reviewPool = res.questions || [];
        } catch (err) {
          console.warn('Failed to fetch review questions, proceeding with current node only', err);
        }

        const currentQuestions = [...(masteryCheck.activity_data?.questions || [])];
        
        // Pick 7 or 8 questions from current node
        const numCurrent = Math.min(currentQuestions.length, Math.random() > 0.5 ? 8 : 7);
        const shuffledCurrent = currentQuestions.sort(() => 0.5 - Math.random());
        const selectedCurrent = shuffledCurrent.slice(0, numCurrent);

        // Pick review questions to reach exactly 10
        const numReviewNeeded = 10 - selectedCurrent.length;
        const availableReview = reviewPool.filter(rq => 
          !selectedCurrent.some(cq => cq.question === rq.question)
        );
        const selectedReview = availableReview.sort(() => 0.5 - Math.random()).slice(0, numReviewNeeded);

        // Final merge and shuffle
        const finalQuestions = [...selectedCurrent, ...selectedReview].sort(() => 0.5 - Math.random());
        
        setQuizData({
          ...masteryCheck,
          activity_data: {
            ...masteryCheck.activity_data,
            questions: finalQuestions
          }
        });
        setReviewCount(selectedReview.length);
        setAssessmentStatus('idle');
      } catch (err) {
        console.error('Quiz Initialization Error:', err);
        setAssessmentStatus('failed');
        setFeedbackMessage('Failed to prepare the quiz. Please refresh.');
      }
    };

    initializeQuiz();
  }, [masteryCheck, node?.node_id]);

  const handleSubmit = async (userResponse, activityType) => {
    // Hard guard: prevent double-submit if already processing
    if (assessmentStatus === 'loading' || assessmentStatus === 'initializing') return;

    try {
      setAssessmentStatus('loading');
      setFeedbackMessage('');

      const response = await submitMasteryCheck(
        node.node_id,
        activityType,
        userResponse,
        quizData // Send the subsetted/merged quiz to match backend grading
      );

      setResult(response);

      if (response.passed) {
        setAssessmentStatus('success');
        setFeedbackMessage(response.feedback || 'Excellent work!');
      } else {
        setAssessmentStatus('failed');
        setFeedbackMessage(response.feedback || 'Please review the material and try again.');
      }
    } catch (error) {
      console.error('Error submitting mastery check:', error);
      setAssessmentStatus('failed');
      setFeedbackMessage('An error occurred. Please try again.');
    }
  };

  const handleReturnToMap = () => {
    const slug = regionName || 'time-matrix';
    navigate(`/region/${slug}`);
  };

  if (assessmentStatus === 'success') {
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

        {/* Rewards Display */}
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
                <Award className={`
                  ${rewards?.medal_tier === 'Bronze' ? 'text-amber-600' : ''}
                  ${rewards?.medal_tier === 'Silver' ? 'text-gray-400' : ''}
                  ${rewards?.medal_tier === 'Gold' ? 'text-brand-gold' : ''}
                `} size={32} />
              </div>
              <p className="text-sm text-gray-600">{rewards?.medal_tier} Medal</p>
            </div>
          </div>
        </div>

        {/* AI Feedback (if provided) */}
        {result?.feedback && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Instructor Feedback</h3>
            <p className="text-blue-800 leading-relaxed whitespace-pre-line">{result.feedback}</p>
          </div>
        )}

        {/* Return Button */}
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

  if (!masteryCheck) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-soft text-center">
        <p className="text-gray-600">No mastery check available for this node.</p>
      </div>
    );
  }

  const renderAssessment = () => {
    if (!quizData) return null;
    const { type, prompt_to_student, activity_data, ai_grading_rubric } = quizData;

    const commonProps = {
      prompt: prompt_to_student,
      activityData: activity_data,
      onSubmit: handleSubmit,
      assessmentStatus,
      feedbackMessage,
    };

    return (
      <>
        {reviewCount > 0 && (
          <div className="bg-brand-navy border-l-4 border-brand-gold rounded-lg p-4 mb-6 flex items-center gap-3">
            <Info className="text-brand-gold" size={20} />
            <p className="text-white text-sm font-medium">
              Keep your eyes open! <span className="text-brand-gold font-bold">{reviewCount}</span> of these questions are review from past lessons.
            </p>
          </div>
        )}
        
        {(() => {
          switch (type) {
            case 'multiple_choice':
              return <MultipleChoice {...commonProps} />;
            case 'error_correction':
              return <ErrorCorrection {...commonProps} />;
            case 'fill_in_the_blank':
              return <FillInTheBlank {...commonProps} />;
            case 'ai_graded_text_input':
              return <AIGradedTextInput {...commonProps} aiRubric={ai_grading_rubric} />;
            default:
              return (
                <div className="bg-white rounded-xl p-8 shadow-soft text-center">
                  <p className="text-gray-600">Unknown assessment type: {type}</p>
                </div>
              );
          }
        })()}
      </>
    );
  };

  if (assessmentStatus === 'initializing') {
    return (
      <div className="bg-white rounded-xl p-20 shadow-soft flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-brand-primary mb-4" size={48} />
        <p className="text-gray-600 font-medium">Preparing your personalized quiz...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-8 shadow-soft">
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-brand-primary mb-2">Mastery Check</h2>
        <p className="text-gray-600">Demonstrate your understanding to unlock the next node.</p>
      </div>
      {renderAssessment()}
    </div>
  );
}
