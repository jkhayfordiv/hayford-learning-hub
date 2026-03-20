import { useState, useEffect, useRef } from 'react'

const PART_1_QUESTIONS = [
  "Describe your hometown. What do you like most about it?",
  "Do you work or are you a student? Tell me about your work/studies.",
  "What do you like to do in your free time?",
  "Do you prefer to spend time with family or friends? Why?",
  "What kind of music do you enjoy listening to?"
];

function App() {
  const [token, setToken] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(PART_1_QUESTIONS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const [browserSupported, setBrowserSupported] = useState(true);
  
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Extract token from URL or localStorage
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem('token', urlToken);
    } else {
      setToken(localStorage.getItem('token'));
    }
  }, []);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setBrowserSupported(false);
      return;
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      setTranscript(prev => prev + finalTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Microphone error: ${event.error}. Please check permissions.`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecording) {
        recognition.start(); // Restart if still recording
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);

  const handleNewQuestion = () => {
    const randomQuestion = PART_1_QUESTIONS[Math.floor(Math.random() * PART_1_QUESTIONS.length)];
    setCurrentQuestion(randomQuestion);
    setTranscript('');
    setFeedback(null);
    setError('');
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setError('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      setError('Please record your response before submitting.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiBase}/api/ielts/speak/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          questionPrompt: currentQuestion,
          part: '1'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get feedback from AI examiner');
      }

      const result = await response.json();
      setFeedback(result);

      // Auto-save score to dashboard
      if (token && result.scores?.overall) {
        try {
          const saveRes = await fetch(`${apiBase}/api/scores`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              module_type: 'speaking',
              submitted_text: transcript.trim(),
              word_count: transcript.trim().split(/\s+/).length,
              overall_score: result.scores.overall,
              ai_feedback: result
            })
          });
          
          if (!saveRes.ok) {
            console.error('Failed to auto-save speaking score');
          }
        } catch (saveErr) {
          console.error('Error auto-saving speaking score:', saveErr);
        }
      }
    } catch (err) {
      console.error('Grading error:', err);
      setError('Failed to grade your response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setTranscript('');
    setFeedback(null);
    setError('');
    handleNewQuestion();
  };

  if (!browserSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-200 max-w-2xl">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Browser Not Supported</h2>
          <p className="text-slate-600 text-lg mb-6">
            Your browser doesn't support the Web Speech API. Please use Google Chrome, Microsoft Edge, or Safari.
          </p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (feedback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
              Your IELTS Speaking Score
            </h1>
            <p className="text-slate-600">AI Examiner Feedback</p>
          </div>

          {/* Overall Band Score */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-12 text-center mb-8 text-white">
            <div className="text-sm font-black uppercase tracking-widest mb-2 opacity-90">Overall Band Score</div>
            <div className="text-8xl font-black mb-2">{feedback.scores.overall}</div>
            <div className="text-lg opacity-90">Out of 9.0</div>
          </div>

          {/* Score Breakdown */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Fluency & Coherence</div>
              <div className="text-4xl font-black text-indigo-600">{feedback.scores.fluency}</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Lexical Resource</div>
              <div className="text-4xl font-black text-purple-600">{feedback.scores.lexical}</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Grammar Range</div>
              <div className="text-4xl font-black text-pink-600">{feedback.scores.grammar}</div>
            </div>
          </div>

          {/* Feedback Cards */}
          <div className="space-y-6 mb-8">
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-black text-green-900 uppercase text-sm tracking-wider">Strengths</h3>
              </div>
              <p className="text-green-800 leading-relaxed">{feedback.feedback.strengths}</p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="font-black text-amber-900 uppercase text-sm tracking-wider">Areas to Improve</h3>
              </div>
              <p className="text-amber-800 leading-relaxed">{feedback.feedback.weaknesses}</p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="font-black text-blue-900 uppercase text-sm tracking-wider">Improvement Tip</h3>
              </div>
              <p className="text-blue-800 leading-relaxed">{feedback.feedback.improvement_tip}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleReset}
              className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Another Question
            </button>
            <a
              href="/"
              className="bg-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold hover:bg-slate-300 transition-colors shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-slate-900 mb-2 tracking-tight">
            IELTS Speaking Simulator
          </h1>
          <p className="text-lg text-slate-600 font-medium">Part 1 - Introduction & Interview</p>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-2">Examiner's Question</div>
              <p className="text-2xl font-bold text-slate-900 leading-relaxed">{currentQuestion}</p>
            </div>
            <button
              onClick={handleNewQuestion}
              className="ml-4 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              New Question
            </button>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-slate-200">
          <div className="text-center mb-6">
            <button
              onClick={toggleRecording}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
            <p className="mt-4 text-sm font-bold text-slate-600">
              {isRecording ? '🔴 Recording... Click to stop' : 'Click microphone to start recording'}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              Your Response (editable)
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your spoken response will appear here... You can edit it before submitting."
              className="w-full h-40 p-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none text-slate-800 leading-relaxed"
            />
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || !transcript.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-black text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Examiner is grading...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Get Band Score
              </>
            )}
          </button>
        </div>

        {/* Back to Dashboard */}
        <div className="text-center">
          <a 
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

export default App
