import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, XCircle, ArrowRight, Save, LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function App() {
  const [token, setToken] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [targetWords, setTargetWords] = useState([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputSentence, setInputSentence] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  const [sessionResults, setSessionResults] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ loading: false, success: false, error: null });

  useEffect(() => {
    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const metaString = params.get('taskMeta');

    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem('token', urlToken);
    } else {
      setToken(localStorage.getItem('token'));
    }

    if (metaString) {
      try {
        const meta = JSON.parse(decodeURIComponent(metaString));
        if (meta.assignment_id) setTaskId(meta.assignment_id);
        if (meta.instructions) {
          const words = meta.instructions.split(/[\n, ]+/).map(w => w.trim()).filter(w => w.length > 0);
          setTargetWords(words);
        }
      } catch (e) {
        console.error('Error parsing taskMeta', e);
      }
    }
  }, []);

  const handleCheckSentence = async () => {
    if (!inputSentence.trim()) return;
    setIsChecking(true);
    setFeedback(null);

    const currentWord = targetWords[currentIndex];
    
    const prompt = `
      You are an English language tutor grading a vocabulary exercise.
      The student was instructed to write exactly ONE sentence using the target word.
      
      Target Word: "${currentWord}"
      Student Sentence: "${inputSentence}"
      
      Evaluate the sentence based on:
      1. used_word: Did they use the target word (or a valid inflection/form of it)? true/false
      2. grammar_ok: Is the sentence grammatically sound? true/false
      3. context_ok: Does the context demonstrate they understand what the word means? true/false
      4. explanation: A concise string explaining the grading, providing corrections if there are grammar errors, and confirming if the context was good.

      Return ONLY a raw JSON object with those four keys. No markdown wrapping.
      Example: {"used_word": true, "grammar_ok": false, "context_ok": true, "explanation": "Good context, but 'he run' should be 'he runs'."}
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error('API Error');

      const rawText = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      
      const isPerfect = parsed.used_word && parsed.grammar_ok && parsed.context_ok;
      
      setFeedback({
        ...parsed,
        isPerfect
      });

    } catch (error) {
      console.error(error);
      setFeedback({
         used_word: false, grammar_ok: false, context_ok: false, isPerfect: false,
         explanation: "Connection Busy: The AI service is currently overloaded or there is a network issue. Please try submitting again."
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleNextWord = () => {
    // Save current result
    setSessionResults(prev => [
      ...prev, 
      {
        word: targetWords[currentIndex],
        sentence: inputSentence,
        feedback: feedback
      }
    ]);

    if (currentIndex + 1 < targetWords.length) {
      setCurrentIndex(prev => prev + 1);
      setInputSentence('');
      setFeedback(null);
    } else {
      setIsCompleted(true);
    }
  };

  const submitScoreToHub = async () => {
    if (!token) {
      setSaveStatus({ loading: false, success: false, error: 'Not authenticated with Hub.' });
      return;
    }

    setSaveStatus({ loading: true, success: false, error: null });

    // Calculate score based on how many sentences were 'perfect'
    const correctCount = sessionResults.filter(r => r.feedback?.isPerfect).length;
    const score = (correctCount / targetWords.length) * 100;
    
    // Create submitted text overview
    const fullText = sessionResults.map(r => `Word: ${r.word}\nSentence: ${r.sentence}`).join('\n\n');

    try {
      const taskIdNum = taskId != null ? parseInt(taskId, 10) : null;
      const apiBase = import.meta.env.VITE_API_URL || 'https://hayford-learning-hub.onrender.com';
      const res = await fetch(`${apiBase}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          module_type: 'vocabulary',
          taskId: Number.isInteger(taskIdNum) ? taskIdNum : undefined,
          submitted_text: fullText,
          word_count: fullText.split(/\s+/).length,
          overall_score: score,
          ai_feedback: sessionResults
        })
      });

      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      try {
        data = text && contentType.includes('application/json') ? JSON.parse(text) : {};
      } catch (_) {}
      if (!res.ok) throw new Error(data.error || data.details || 'Failed to save to dashboard.');
      
      setSaveStatus({ loading: false, success: true, error: null });
    } catch (error) {
      console.error("Save Error:", error);
      setSaveStatus({ loading: false, success: false, error: error.message });
    }
  };

  if (!targetWords || targetWords.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center mb-6">
            <BookOpen className="text-slate-400 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Vocabulary Builder</h1>
          <p className="text-slate-500 mb-8">This app requires a task assignment from your teacher containing target words.</p>
          <button 
             onClick={() => window.location.href = '/'}
             className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors flex justify-center items-center gap-2"
          >
            <LayoutDashboard size={18} /> Return to Learning Hub
          </button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-2xl w-full border border-slate-200">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6 border-8 border-green-50">
               <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Session Complete!</h2>
            <p className="text-slate-500 font-medium text-lg">You've finished practicing {targetWords.length} words.</p>
          </div>

          <div className="space-y-4 mb-10">
            {sessionResults.map((res, i) => (
              <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                   <div className="font-black uppercase tracking-widest text-[10px] text-slate-400">Target Word</div>
                   {res.feedback?.isPerfect ? (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-md">Mastered</span>
                   ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">Needs Review</span>
                   )}
                </div>
                 <div className="text-lg font-bold text-slate-900">{res.word}</div>
                <div className="text-slate-700 mt-2 font-medium italic">"{res.sentence}"</div>
                {res.feedback?.explanation && (
                  <div className="text-sm text-slate-500 mt-2 pt-2 border-t border-slate-200">
                    💡 {res.feedback.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {saveStatus.success ? (
            <div className="bg-green-50 text-green-800 p-6 rounded-2xl border border-green-200 text-center space-y-4">
              <p className="font-bold text-lg">Progress Synced Successfully!</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
               >
                <LayoutDashboard size={18} /> Return to Hub
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                 onClick={submitScoreToHub}
                 disabled={saveStatus.loading}
                 className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-950 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {saveStatus.loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saveStatus.loading ? 'Syncing...' : 'Sync Progress to Hub'}
              </button>
              <button 
                 onClick={() => window.location.href = '/'}
                 className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-50 transition-colors flex justify-center items-center gap-2"
              >
                <LayoutDashboard size={18} /> Return to Hub
              </button>
            </div>
          )}
          {saveStatus.error && <p className="text-red-500 text-center mt-4 font-bold text-sm bg-red-50 p-3 rounded-lg">{saveStatus.error}</p>}
        </div>
      </div>
    );
  }

  const currentWord = targetWords[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
       <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Hayford Logo" className="w-10 h-10 object-contain mx-auto" />
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-none text-lg">Vocabulary Builder</h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Adaptive Practice</span>
          </div>
        </div>
        <button 
           onClick={() => window.location.href = '/'}
           className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-sm font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
        >
          <LayoutDashboard size={16} /> Hub
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-2xl bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200 relative overflow-hidden">
           
           <div className="absolute top-0 left-0 h-1.5 bg-slate-100 w-full">
              <div 
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${(currentIndex / targetWords.length) * 100}%` }}
              ></div>
           </div>

           <div className="mb-4">
             <span className="text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
               Word {currentIndex + 1} of {targetWords.length}
             </span>
           </div>
           
           <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-8 mt-6">
             {currentWord}
           </h2>

           <div className="space-y-4 text-left">
             <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 ml-1">Write a sentence using this word:</label>
             <textarea
               disabled={feedback !== null || isChecking}
               value={inputSentence}
               onChange={(e) => setInputSentence(e.target.value)}
               placeholder="Type your sentence here..."
               rows={4}
               className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl p-5 text-lg font-medium focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all resize-none shadow-inner"
             />
           </div>

           {!feedback ? (
             <div className="mt-8 flex justify-end">
               <button
                 onClick={handleCheckSentence}
                 disabled={!inputSentence.trim() || isChecking}
                 className="bg-slate-900 hover:bg-slate-950 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-lg font-bold px-8 py-3.5 rounded-xl transition-colors flex items-center gap-2 shadow-soft"
               >
                 {isChecking ? (
                   <><RefreshCw className="animate-spin w-5 h-5" /> Checking...</>
                 ) : (
                   <><CheckCircle size={20} /> Evaluate Sentence</>
                 )}
               </button>
             </div>
           ) : (
             <div className={`mt-8 p-6 rounded-2xl border ${feedback.isPerfect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} text-left animate-in slide-in-from-bottom-2`}>
                <div className="flex items-start gap-4">
                  {feedback.isPerfect ? (
                    <div className="bg-green-100 p-2 rounded-xl"><CheckCircle className="text-green-600 w-6 h-6" /></div>
                  ) : (
                    <div className="bg-red-100 p-2 rounded-xl"><XCircle className="text-red-600 w-6 h-6" /></div>
                  )}
                  <div className="flex-1">
                    <h3 className={`text-lg font-black ${feedback.isPerfect ? 'text-green-800' : 'text-red-800'}`}>
                      {feedback.isPerfect ? 'Excellent!' : 'Needs Polish'}
                    </h3>
                    <p className={`mt-1 font-medium ${feedback.isPerfect ? 'text-green-700' : 'text-red-700'}`}>
                      {feedback.explanation}
                    </p>
                    
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      <div className="bg-white/60 p-2 border border-black/5 rounded-lg flex justify-between items-center text-sm font-semibold text-slate-700">
                        <span>Used Word</span>
                        {feedback.used_word ? <CheckCircle size={16} className="text-green-600"/> : <XCircle size={16} className="text-red-600"/>}
                      </div>
                      <div className="bg-white/60 p-2 border border-black/5 rounded-lg flex justify-between items-center text-sm font-semibold text-slate-700">
                        <span>Grammar Okay</span>
                        {feedback.grammar_ok ? <CheckCircle size={16} className="text-green-600"/> : <XCircle size={16} className="text-red-600"/>}
                      </div>
                      <div className="bg-white/60 p-2 border border-black/5 rounded-lg flex justify-between items-center text-sm font-semibold text-slate-700">
                        <span>Context Okay</span>
                        {feedback.context_ok ? <CheckCircle size={16} className="text-green-600"/> : <XCircle size={16} className="text-red-600"/>}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleNextWord}
                        className={`font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-sm ${feedback.isPerfect ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                      >
                         Continue <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
             </div>
           )}

        </div>
      </main>
    </div>
  );
}
