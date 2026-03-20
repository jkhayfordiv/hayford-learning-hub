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
  "How important is technology in your daily life?",
  "Do you think it is important to learn a foreign language?",
]

function getRandomQuestion(exclude = '') {
  const pool = PART_1_QUESTIONS.filter((q) => q !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function App() {
  // --- Theme ---
  useEffect(() => {
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // --- Auth ---
  const [token, setToken] = useState(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setToken(urlToken)
      localStorage.setItem('token', urlToken)
    } else {
      setToken(localStorage.getItem('token'))
    }
  }, [])

  // --- Question ---
  const [currentQuestion, setCurrentQuestion] = useState(() => getRandomQuestion())

  // --- Recording ---
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

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
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(250) // collect data every 250ms
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
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
    setIsRecording(false)
  }

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleNewQuestion = () => {
    if (isRecording) stopRecording()
    setCurrentQuestion(getRandomQuestion(currentQuestion))
    setAudioBlob(null)
    setAudioUrl(null)
    setFeedback(null)
    setError('')
    setRecordingSeconds(0)
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
          // Do NOT set Content-Type — browser sets it with multipart boundary
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
    setAudioBlob(null)
    setAudioUrl(null)
    setFeedback(null)
    setError('')
    setRecordingSeconds(0)
    setCurrentQuestion(getRandomQuestion(currentQuestion))
  }

  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  // --- Feedback View ---
  if (feedback) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-[#0A1930] text-slate-900 dark:text-slate-100 px-4 py-8 md:py-12 transition-colors duration-300">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { window.location.href = '/dashboard' }}
              className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              ← Dashboard
            </button>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">IELTS Speaking</span>
          </div>

          {/* Band Score Hero */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 md:p-10 text-center text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,_transparent_60%)]"></div>
            <p className="text-xs font-black uppercase tracking-widest mb-3 opacity-80">AI Examiner Result</p>
            <div className="text-8xl font-black mb-1">{feedback.scores?.overall ?? '—'}</div>
            <p className="text-sm opacity-75 font-semibold">Overall Band Score / 9.0</p>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Fluency', key: 'fluency', color: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Lexical', key: 'lexical', color: 'text-purple-600 dark:text-purple-400' },
              { label: 'Grammar', key: 'grammar', color: 'text-rose-600 dark:text-rose-400' },
              { label: 'Pronunciation', key: 'pronunciation', color: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, key, color }) => (
              feedback.scores?.[key] !== undefined && (
                <div key={key} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</p>
                  <p className={`text-3xl font-black ${color}`}>{feedback.scores[key]}</p>
                </div>
              )
            ))}
          </div>

          {/* Feedback Cards */}
          <div className="space-y-4">
            {[
              { key: 'strengths', label: '✅ Strengths', bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800/50', text: 'text-green-800 dark:text-green-300' },
              { key: 'weaknesses', label: '⚠️ Areas to Improve', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800/50', text: 'text-amber-800 dark:text-amber-300' },
              { key: 'improvement_tip', label: '💡 Tip', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800/50', text: 'text-blue-800 dark:text-blue-300' },
            ].map(({ key, label, bg, border, text }) => (
              feedback.feedback?.[key] && (
                <div key={key} className={`${bg} border-2 ${border} rounded-2xl p-6`}>
                  <p className="text-xs font-black uppercase tracking-widest mb-3 text-slate-500 dark:text-slate-400">{label}</p>
                  <p className={`leading-relaxed font-medium ${text}`}>{feedback.feedback[key]}</p>
                </div>
              )
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all transform hover:scale-[1.02]"
            >
              Try Another Question
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard' }}
              className="px-6 py-4 rounded-2xl font-bold text-sm bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </main>
    )
  }

  // --- Main Recorder View ---
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-[#0A1930] text-slate-900 dark:text-slate-100 px-4 py-8 md:py-12 transition-colors duration-300">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Top Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            ← Dashboard
          </button>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">IELTS Speaking • Part 1</span>
        </div>

        {/* Header Card */}
        <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] font-black text-indigo-500 dark:text-indigo-400 mb-2">AI Speaking Examiner</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">IELTS Speaking Simulator</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Record your spoken response. The AI will evaluate your fluency, vocabulary, grammar, and pronunciation.</p>
        </section>

        {/* Question Card */}
        <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 rounded-l-3xl"></div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 pl-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-3">Examiner's Question</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white leading-snug">{currentQuestion}</p>
            </div>
            <button
              onClick={handleNewQuestion}
              disabled={isRecording}
              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-slate-200 dark:border-slate-600 flex-shrink-0"
            >
              New
            </button>
          </div>
        </section>

        {/* Recorder Card */}
        <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm">
          {/* Big Mic Button */}
          <div className="flex flex-col items-center gap-5 mb-6">
            <div className="relative">
              {/* Pulsing ring while recording */}
              {isRecording && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping"></span>
                  <span className="absolute -inset-3 rounded-full border-2 border-red-400 opacity-30 animate-pulse"></span>
                </>
              )}
              <button
                onClick={handleToggleRecording}
                className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
                }`}
              >
                {isRecording ? (
                  /* Stop icon */
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  /* Mic icon */
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </button>
            </div>

            <div className="text-center">
              {isRecording ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-sm font-black text-red-500 uppercase tracking-widest">Recording</span>
                  </div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white font-mono tabular-nums">{formatTime(recordingSeconds)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Click the button again to stop</p>
                </div>
              ) : audioBlob ? (
                <div className="space-y-1">
                  <p className="text-sm font-black text-green-600 dark:text-green-400 uppercase tracking-widest">✓ Response Captured</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Duration: {formatTime(recordingSeconds)}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Click mic to record again</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Click the microphone to start</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Your browser will ask for microphone permission</p>
                </div>
              )}
            </div>
          </div>

          {/* Audio Playback (after recording) */}
          {audioUrl && !isRecording && (
            <div className="mb-5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Playback Your Response</p>
              <audio controls src={audioUrl} className="w-full h-10 rounded-xl" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !audioBlob || isRecording}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:disabled:text-slate-500 text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                AI Examiner is grading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit for Grading
              </>
            )}
          </button>
        </section>

        {/* Tips */}
        <section className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Tips for a Higher Band</p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
            <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">▸</span> Speak for 1–2 minutes, using full sentences.</li>
            <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">▸</span> Use connectors like "furthermore", "however", "as a result".</li>
            <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">▸</span> Use a variety of vocabulary — avoid repetition.</li>
            <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">▸</span> Speak clearly and at a natural pace — don't rush.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
