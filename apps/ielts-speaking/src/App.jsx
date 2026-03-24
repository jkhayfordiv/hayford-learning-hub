import { useState, useEffect, useRef } from 'react'

const PART_1_QUESTIONS = [
  "Describe your hometown. What do you like most about it?",
  "Do you work or are you a student? Tell me about your work or studies.",
  "What do you like to do in your free time?",
  "Do you prefer to spend time with family or friends? Why?",
  "What kind of music do you enjoy listening to?",
  "How do you usually spend your weekends?",
  "What is your favourite season of the year and why?",
  "Do you prefer living in a city or in the countryside?",
  "How important is technology in your daily life? How much time do you spend online?",
  "Do you think it is important to learn a foreign language? Why?",
  "What are your future plans for your career or education?",
  "Describe your typical daily routine. Which part of the day do you like best?",
  "Do you enjoy travelling to new places? Where would you like to visit in the future?",
  "What kind of food do you like to eat? Do you prefer eating at home or at restaurants?",
  "Is it important to protect the environment? What can individuals do to help?",
  "Do you use social media often? What are the advantages and disadvantages of it?",
  "Tell me about a memorable event from your childhood. Why was it special?",
  "What subjects did you enjoy most at school? Why?",
  "Do you think life is better now than it was in the past? Why or why not?",
  "Describe a person you admire. Who are they and why are they special to you?",
  "Describe a piece of technology you find useful. How does it help you in your daily life?",
]

function getRandomQuestion(exclude = '') {
  const pool = PART_1_QUESTIONS.filter((q) => q !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function App() {
  // --- Forced Light Theme ---
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // --- Auth ---
  const [token, setToken] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setToken(urlToken)
      localStorage.setItem('token', urlToken)
    } else {
      setToken(localStorage.getItem('token'))
    }
    setAuthChecked(true)
  }, [])

  // --- Multi-Question Session ---
  const [sessionQuestions, setSessionQuestions] = useState(() => {
    const questions = []
    const used = new Set()
    while (questions.length < 4) {
      const q = PART_1_QUESTIONS[Math.floor(Math.random() * PART_1_QUESTIONS.length)]
      if (!used.has(q)) {
        questions.push(q)
        used.add(q)
      }
    }
    return questions
  })
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const currentQuestion = sessionQuestions[currentQuestionIndex]

  // --- Recording ---
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(240) // 4 minutes = 240 seconds
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const sessionTimerRef = useRef(null)

  // --- Submission ---
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState('')

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const startRecording = async () => {
    setError('')
    setAudioBlob(null)
    setAudioUrl(null)
    setFeedback(null)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(250)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)

      // Start 4-minute countdown timer
      sessionTimerRef.current = setInterval(() => {
        setSessionTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up - auto-stop recording
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permissions and try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    clearInterval(timerRef.current)
    clearInterval(sessionTimerRef.current)
    setIsRecording(false)
  }

  const handleToggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  const handleNextQuestion = () => {
    // Navigate to next question WITHOUT stopping recording
    if (currentQuestionIndex < sessionQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePrevQuestion = () => {
    // Navigate to previous question WITHOUT stopping recording
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleNewSession = () => {
    if (isRecording) stopRecording()
    // Generate new set of 4 questions
    const questions = []
    const used = new Set()
    while (questions.length < 4) {
      const q = PART_1_QUESTIONS[Math.floor(Math.random() * PART_1_QUESTIONS.length)]
      if (!used.has(q)) {
        questions.push(q)
        used.add(q)
      }
    }
    setSessionQuestions(questions)
    setCurrentQuestionIndex(0)
    setAudioBlob(null)
    setAudioUrl(null)
    setFeedback(null)
    setError('')
    setRecordingSeconds(0)
    setSessionTimeRemaining(240)
  }

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError('Please record your response first before submitting.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com')

      const formData = new FormData()
      formData.append('audio', audioBlob, 'response.webm')
      formData.append('prompt', currentQuestion)
      formData.append('part', '1')

      const response = await fetch(`${apiBase}/api/ielts/evaluate`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Server responded with ${response.status}`)
      }

      const result = await response.json()
      setFeedback(result)
    } catch (err) {
      setError(err.message || 'Failed to evaluate your response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    // Generate new set of 4 questions
    const questions = []
    const used = new Set()
    while (questions.length < 4) {
      const q = PART_1_QUESTIONS[Math.floor(Math.random() * PART_1_QUESTIONS.length)]
      if (!used.has(q)) {
        questions.push(q)
        used.add(q)
      }
    }
    setSessionQuestions(questions)
    setCurrentQuestionIndex(0)
    setAudioBlob(null)
    setAudioUrl(null)
    setFeedback(null)
    setError('')
    setRecordingSeconds(0)
    setSessionTimeRemaining(240)
  }

  if (!authChecked) return null

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 border border-slate-200 shadow-xl text-center space-y-8">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto border-2 border-indigo-100">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3.5a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Access Restricted</h2>
            <p className="text-slate-500 leading-relaxed font-medium">
              The Speaking Simulator requires active authentication. Please launch this module from your <span className="text-indigo-600 font-semibold">Student Dashboard</span>.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-widest text-xs"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    )
  }

  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  if (feedback) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 font-sans">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Performance Report</h1>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Official AI Assessment Result</p>
            </div>
            <button
                onClick={() => { window.location.href = '/dashboard' }}
                className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900 px-6 py-3 rounded-2xl font-bold text-sm shadow-sm transition-all hover:bg-slate-50"
            >
                Dashboard
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Scores */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 text-white rounded-[2rem] p-12 text-center shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-50"></div>
                    <p className="relative text-xs font-black uppercase tracking-[0.25em] mb-6 text-indigo-300">Overall Band Score</p>
                    <div className="relative text-[8rem] font-black leading-none mb-4 animate-in fade-in zoom-in duration-700">{feedback.scores?.overall ?? '—'}</div>
                    <p className="relative text-lg font-medium text-slate-400">Out of 9.0</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Fluency', key: 'fluency', border: 'border-blue-100', bg: 'bg-blue-50/30' },
                    { label: 'Lexical', key: 'lexical', border: 'border-indigo-100', bg: 'bg-indigo-50/30' },
                    { label: 'Grammar', key: 'grammar', border: 'border-purple-100', bg: 'bg-purple-50/30' },
                    { label: 'Pronunciation', key: 'pronunciation', border: 'border-amber-100', bg: 'bg-amber-50/30' },
                  ].map(({ label, key, border, bg }) => (
                    feedback.scores?.[key] !== undefined && (
                      <div key={key} className={`bg-white border ${border} rounded-2xl p-6 text-center shadow-sm relative overflow-hidden`}>
                        <div className={`absolute top-0 right-0 w-8 h-8 ${bg} rounded-bl-3xl`}></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">{label}</p>
                        <p className="text-3xl font-black text-slate-900">{feedback.scores[key]}</p>
                      </div>
                    )
                  ))}
                </div>
            </div>

            {/* Right Column: Feedback Details */}
            <div className="lg:col-span-7 space-y-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
                    {[
                    { key: 'strengths', label: 'Positive Indicators', icon: 'M5 13l4 4L19 7', color: 'text-green-600', bg: 'bg-green-50' },
                    { key: 'weaknesses', label: 'Development Points', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'text-amber-600', bg: 'bg-amber-50' },
                    { key: 'improvement_tip', label: 'Recommended Strategy', icon: 'M9.663 17h4.674a1 1 0 00.958-.713l.7-2.587A8 8 0 106.005 13.712l.71 2.575a1 1 0 00.958.713h1.99z', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    ].map(({ key, label, icon, color, bg }) => (
                    feedback.feedback?.[key] && (
                        <div key={key} className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 ${bg} ${color} rounded-lg flex items-center justify-center`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">{label}</h3>
                            </div>
                            <p className="text-slate-600 leading-relaxed font-medium pl-11">{feedback.feedback[key]}</p>
                            <div className="h-px bg-slate-100 last:hidden"></div>
                        </div>
                    )
                    ))}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleReset}
                        className="flex-1 px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        New Assessment
                    </button>
                    <button
                        onClick={() => { window.location.href = '/dashboard' }}
                        className="px-8 py-5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-md transition-all hover:bg-slate-50"
                    >
                        Finish
                    </button>
                </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 font-sans overflow-x-hidden">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Header Section */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-8">
            <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-600">IELTS Master v2.0</p>
                <h1 className="text-4xl font-black tracking-tighter text-slate-950">Speaking Simulator</h1>
            </div>
            <button
                onClick={() => { window.location.href = '/dashboard' }}
                className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all hover:bg-slate-50 uppercase tracking-widest"
            >
                Dashboard
            </button>
        </header>

        {/* Examiner Module */}
        <section className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xs ring-4 ring-slate-100 shadow-sm">AI</div>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">Virtual Examiner</h2>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 md:p-14 shadow-sm relative overflow-hidden group transition-all">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50/30 rounded-full blur-3xl -mr-20 -mt-20"></div>
                
                <div className="relative space-y-6">
                    {/* Question Counter & Timer */}
                    <div className="flex items-center justify-between">
                        <span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm">
                            Question {currentQuestionIndex + 1} of {sessionQuestions.length}
                        </span>
                        <div className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm ${
                          sessionTimeRemaining <= 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600'
                        }`}>
                            Time: {formatTime(sessionTimeRemaining)}
                        </div>
                    </div>

                    {/* All Questions List */}
                    <div className="space-y-3">
                        {sessionQuestions.map((q, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-2xl border-2 transition-all ${
                                    idx === currentQuestionIndex
                                        ? 'border-indigo-500 bg-indigo-50/50'
                                        : 'border-slate-200 bg-slate-50/50 opacity-60'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                        idx === currentQuestionIndex ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <p className={`text-sm font-medium leading-relaxed ${
                                        idx === currentQuestionIndex ? 'text-slate-900' : 'text-slate-500'
                                    }`}>
                                        {q}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Navigation Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4">
                        <button
                            onClick={handlePrevQuestion}
                            disabled={currentQuestionIndex === 0}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 shadow-sm"
                        >
                            ← Previous
                        </button>
                        <button
                            onClick={handleNextQuestion}
                            disabled={currentQuestionIndex === sessionQuestions.length - 1}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 shadow-sm"
                        >
                            Next →
                        </button>
                        <button
                            onClick={handleNewSession}
                            disabled={isRecording}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 shadow-sm ml-auto"
                        >
                            New Session
                        </button>
                    </div>
                </div>
            </div>
        </section>

        {/* Recording Interface */}
        <section className="bg-slate-900 text-white rounded-[2.5rem] p-12 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
            
            <div className="relative flex flex-col items-center gap-10">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        {isRecording && (
                            <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping scale-150"></div>
                        )}
                        <button
                            onClick={handleToggleRecording}
                            className={`relative w-20 h-20 rounded-full border-4 border-slate-800 flex items-center justify-center transition-all transform active:scale-95 group shadow-inner ${
                                isRecording ? 'bg-white' : 'bg-slate-800 hover:bg-slate-700 hover:border-slate-600'
                            }`}
                        >
                            {isRecording ? (
                                <div className="w-6 h-6 bg-red-600 rounded-sm"></div>
                            ) : (
                                <svg className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                                </svg>
                            )}
                        </button>
                    </div>
                    
                    <div className="text-center space-y-1">
                        <p className={`text-sm font-black uppercase tracking-[0.2em] ${isRecording ? 'text-red-400' : 'text-slate-400'}`}>
                            {isRecording ? 'Recording Live' : audioBlob ? 'Response Ready' : 'Standby'}
                        </p>
                        <p className={`text-4xl font-black tabular-nums transition-all ${isRecording ? 'text-white' : 'text-slate-500'}`}>
                            {formatTime(recordingSeconds)}
                        </p>
                    </div>
                </div>

                {audioUrl && !isRecording && (
                    <div className="w-full max-w-sm space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Review Recording</p>
                        <audio controls src={audioUrl} className="w-full h-8 brightness-110 filter invert contrast-150" />
                      </div>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !audioBlob || isRecording}
                    className="w-full max-w-sm py-5 bg-white hover:bg-slate-50 disabled:bg-slate-800/50 disabled:text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl text-slate-900 shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 group"
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            Analyzing Audio...
                        </>
                    ) : (
                        <>
                            Evaluate Performance
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </>
                    )}
                </button>
            </div>
        </section>

        {/* Evaluation Criteria */}
        <section className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Assessment Criteria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-medium text-slate-600">
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-indigo-500 font-bold text-lg">01</span>
                    <p>Fluency & Coherence: Maintain a natural pace and use appropriate connectors.</p>
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-indigo-500 font-bold text-lg">02</span>
                    <p>Lexical Resource: Demonstrate a wide range of academic vocabulary.</p>
                </div>
            </div>
        </section>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </main>
  )
}
