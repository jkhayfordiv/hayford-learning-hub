import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Send, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';
import articleBank from './data/articleBank.json';

const getToken = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token') || localStorage.getItem('token');
};

export default function PracticeView({ onReturnHome }) {
  const [exercise, setExercise] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isGraded, setIsGraded] = useState(false);
  const [results, setResults] = useState([]);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadRandomExercise();
  }, []);

  const loadRandomExercise = () => {
    const random = articleBank[Math.floor(Math.random() * articleBank.length)];
    setExercise(random);
    setAnswers(new Array(random.answer_key.length).fill(''));
    setIsGraded(false);
    setResults([]);
    setSubmitError('');
  };

  const handleSelect = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (answers.some(a => a === '')) {
      alert("Please fill in all the blanks before submitting.");
      return;
    }

    const newResults = exercise.answer_key.map((correct, i) => ({
      correct: correct === answers[i],
      expected: correct,
      actual: answers[i],
      explanation: exercise.explanations[i]
    }));
    
    setResults(newResults);
    setIsGraded(true);

    const correctCount = newResults.filter(r => r.correct).length;
    const calculatedScore = (correctCount / exercise.answer_key.length) * 100;
    setScore(calculatedScore);

    const token = getToken();
    if (!token) {
      setSubmitError("Guest Mode: No Hub authentication found. Score not saved.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fullText = exercise.text_parts.map((part, i) => 
        part + (answers[i] ? `[${answers[i]}]` : '')
      ).join('');

      const res = await fetch('https://hayford-learning-hub.onrender.com/api/scores', {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
           module_type: 'article_practice',
           submitted_text: fullText,
           word_count: fullText.split(/\s+/).length,
           overall_score: calculatedScore,
           ai_feedback: newResults
        })
      });

      if (!res.ok) throw new Error("Failed to save score on server");
    } catch (err) {
      console.error(err);
      setSubmitError("Failed to sync score to Hub.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!exercise) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 animate-in zoom-in-95 duration-300">
      
      <div className="flex items-center justify-between mb-8">
        <button onClick={onReturnHome} className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors">
          <BookOpen size={16} /> Back to Lesson
        </button>
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
          Exercise #{exercise.id}
        </span>
      </div>

      <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl mb-8 leading-loose text-lg md:text-xl text-slate-800 font-serif relative">
        {exercise.text_parts.map((part, i) => {
          const isLast = i === exercise.text_parts.length - 1;
          const result = isGraded ? results[i] : null;
          
          return (
            <React.Fragment key={i}>
              {part}
              {!isLast && (
                <span className="inline-block mx-1 align-middle">
                  <select 
                    disabled={isGraded}
                    value={answers[i]}
                    onChange={(e) => handleSelect(i, e.target.value)}
                    className={`
                      appearance-none px-4 py-1.5 rounded-xl font-sans text-base font-bold outline-none transition-all cursor-pointer border-2
                      ${isGraded 
                        ? (result.correct ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700')
                        : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 focus:ring-4 focus:ring-indigo-500/20 shadow-inner'
                      }
                      ${answers[i] === '' && !isGraded ? 'text-indigo-300' : ''}
                    `}
                  >
                    <option value="" disabled>---</option>
                    <option value="a">a</option>
                    <option value="an">an</option>
                    <option value="the">the</option>
                    <option value="none">none</option>
                  </select>
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {isGraded && (
        <div className="space-y-6 mb-8 animate-in slide-in-from-top-4">
          <div className="bg-slate-900 rounded-2xl p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
               {score === 100 ? <CheckCircle2 className="text-green-400 w-10 h-10" /> : <AlertCircle className="text-amber-400 w-10 h-10" />}
               <div>
                 <h3 className="font-black text-xl mb-1">{score === 100 ? 'Perfect Score!' : 'Keep Practicing'}</h3>
                 <p className="text-slate-400 text-sm font-medium">You got {results.filter(r => r.correct).length} out of {exercise.answer_key.length} correct.</p>
               </div>
            </div>
            <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              {score.toFixed(0)}%
            </div>
          </div>

          {submitError && (
             <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm font-bold text-center">
               {submitError}
             </div>
          )}

          <div className="space-y-4">
            {results.map((r, i) => !r.correct && (
              <div key={i} className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-4">
                 <XCircle className="text-red-500 shrink-0" size={24} />
                 <div>
                   <p className="font-bold text-red-900 mb-2">Blank #{i + 1}</p>
                   <p className="text-sm font-medium text-red-800 mb-2">You selected <strong>{r.actual}</strong>, but the correct answer is <strong>{r.expected}</strong>.</p>
                   <p className="text-xs text-red-600 bg-white/50 p-3 rounded-lg border border-red-100 italic">💡 {r.explanation}</p>
                 </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
             <button 
               onClick={loadRandomExercise}
               className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
             >
               <RefreshCw size={18} /> Next Exercise
             </button>
          </div>
        </div>
      )}

      {!isGraded && (
        <div className="flex justify-end">
          <button 
            disabled={isSubmitting || answers.some(a => a === '')}
            onClick={handleSubmit}
            className="bg-slate-900 disabled:bg-slate-300 hover:bg-slate-950 text-white font-black py-4 px-10 rounded-2xl shadow-xl transition-transform active:scale-95 flex items-center gap-3"
          >
            {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
            {isSubmitting ? 'Grading...' : 'Submit Answers'}
          </button>
        </div>
      )}

    </div>
  );
}
