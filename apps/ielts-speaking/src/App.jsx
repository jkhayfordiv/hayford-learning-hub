import { useState, useEffect, useRef } from 'react'

// Part 1 Questions Pool
const PART_1_QUESTIONS = [
  "Describe your hometown. What do you like most about it?",
  "Do you work or are you a student? Tell me about your work or studies.",
  "What do you like to do in your free time?",
  "Do you prefer to spend time with family or friends? Why?",
  "What kind of music do you enjoy listening to?",
  "How do you usually spend your weekends?",
  "What is your favourite season of the year and why?",
  "Do you prefer living in a city or in the countryside?",
]

// Part 2 Cue Cards
const PART_2_CUE_CARDS = [
  {
    prompt: "Describe a person who has had a significant influence on your life.",
    points: [
      "Who this person is",
      "How you know them",
      "What influence they have had on you",
      "And explain why this person is important to you"
    ]
  },
  {
    prompt: "Describe a memorable journey you have taken.",
    points: [
      "Where you went",
      "When you went there",
      "What you did during the journey",
      "And explain why this journey was memorable"
    ]
  },
  {
    prompt: "Describe a skill you would like to learn in the future.",
    points: [
      "What the skill is",
      "Why you want to learn it",
      "How you plan to learn it",
      "And explain how this skill would benefit you"
    ]
  }
]

// Part 3 Discussion Questions
const PART_3_QUESTIONS = [
  "How has technology changed the way people communicate in your country?",
  "Do you think traditional values are still important in modern society? Why or why not?",
  "What role should governments play in protecting the environment?",
  "How do you think education systems could be improved globally?"
]

function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export default function App() {
  // Force light theme
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // Auth
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

  // Assignment metadata (which parts to test)
  const [assignedParts, setAssignedParts] = useState(['1']) // Default to Part 1 only
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const metaString = params.get('taskMeta')
    if (metaString) {
      try {
        const meta = JSON.parse(decodeURIComponent(metaString))
        if (meta.speaking_parts && Array.isArray(meta.speaking_parts)) {
          setAssignedParts(meta.speaking_parts)
        }
      } catch (e) {
        console.error('Error parsing taskMeta', e)
      }
    }
  }, [])

  // Flow controller
  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  const currentPart = assignedParts[currentPartIndex]
  
  // Part-specific content
  const [part1Questions] = useState(() => getRandomItems(PART_1_QUESTIONS, 4))
  const [part2CueCard] = useState(() => PART_2_CUE_CARDS[Math.floor(Math.random() * PART_2_CUE_CARDS.length)])
  const [part3Questions] = useState(() => getRandomItems(PART_3_QUESTIONS, 3))
  
  // Part 1 state
  const [part1QuestionIndex, setPart1QuestionIndex] = useState(0)
  
  // Part 2 state
  const [part2PrepTime, setPart2PrepTime] = useState(60) // 1 minute prep
  const [part2PrepComplete, setPart2PrepComplete] = useState(false)
  const [part2RecordTime, setPart2RecordTime] = useState(120) // 2 minutes record
  
  // Part 3 state
  const [part3QuestionIndex, setPart3QuestionIndex] = useState(0)
  const [part3TimeRemaining, setPart3TimeRemaining] = useState(300) // 5 minutes
  
  // Recording state (per part)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const partTimerRef = useRef(null)
  
  // Completed parts storage
  const [completedParts, setCompletedParts] = useState({})
  
  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState('')

  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  // Part 2 prep timer
  useEffect(() => {
    if (currentPart === '2' && !part2PrepComplete && part2PrepTime > 0) {
      const timer = setInterval(() => {
        setPart2PrepTime(prev => {
          if (prev <= 1) {
            setPart2PrepComplete(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [currentPart, part2PrepComplete, part2PrepTime])

  // Part 2 record timer (auto-stop at 2 minutes)
  useEffect(() => {
    if (currentPart === '2' && isRecording && part2RecordTime > 0) {
      const timer = setInterval(() => {
        setPart2RecordTime(prev => {
          if (prev <= 1) {
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [currentPart, isRecording, part2RecordTime])

  // Part 3 timer
  useEffect(() => {
    if (currentPart === '3' && isRecording && part3TimeRemaining > 0) {
      const timer = setInterval(() => {
        setPart3TimeRemaining(prev => {
          if (prev <= 1) {
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [currentPart, isRecording, part3TimeRemaining])

  const startRecording = async () => {
    setError('')
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
        // Save this part's audio
        setCompletedParts(prev => ({
          ...prev,
          [currentPart]: blob
        }))
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(250)
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
    if (isRecording) stopRecording()
    else startRecording()
  }

  const handleNextPart = () => {
    if (currentPartIndex < assignedParts.length - 1) {
      setCurrentPartIndex(prev => prev + 1)
      setRecordingSeconds(0)
      // Reset part-specific state
      if (assignedParts[currentPartIndex + 1] === '1') {
        setPart1QuestionIndex(0)
      } else if (assignedParts[currentPartIndex + 1] === '2') {
        setPart2PrepTime(60)
        setPart2PrepComplete(false)
        setPart2RecordTime(120)
      } else if (assignedParts[currentPartIndex + 1] === '3') {
        setPart3QuestionIndex(0)
        setPart3TimeRemaining(300)
      }
    }
  }

  const handleSkipPrep = () => {
    setPart2PrepComplete(true)
    setPart2PrepTime(0)
  }

  const handleSubmitAll = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com')

      // Combine all parts into one submission
      const formData = new FormData()
      
      assignedParts.forEach(part => {
        const blob = completedParts[part]
        if (blob) {
          formData.append('audio', blob, `part${part}.webm`)
        }
      })

      formData.append('prompt', `IELTS Speaking Test - Parts: ${assignedParts.join(', ')}`)
      formData.append('part', assignedParts.join(','))

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
      setIsSubmitting(false)
    }
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

  if (feedback) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 font-sans">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="flex items-center justify-between border-b border-slate-200 pb-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Performance Report</h1>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Parts {assignedParts.join(', ')} Complete</p>
            </div>
            <button
                onClick={() => { window.location.href = '/dashboard' }}
                className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900 px-6 py-3 rounded-2xl font-bold text-sm shadow-sm transition-all hover:bg-slate-50"
            >
                Dashboard
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 text-white rounded-[2rem] p-12 text-center shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-50"></div>
                    <p className="relative text-xs font-black uppercase tracking-[0.25em] mb-6 text-indigo-300">Overall Band Score</p>
                    <div className="relative text-[8rem] font-black leading-none mb-4 animate-in fade-in zoom-in duration-700">{feedback.scores?.overall ?? '—'}</div>
                    <p className="relative text-lg font-medium text-slate-400">Out of 9.0</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Fluency & Coherence', key: 'fluency', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
                    { label: 'Lexical Resource', key: 'lexical', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                    { label: 'Grammar Range', key: 'grammar', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                    { label: 'Pronunciation', key: 'pronunciation', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
                  ].map(({ label, key, icon }) => {
                    const score = feedback.scores?.[key] ?? 0;
                    const percentage = (score / 9) * 100;
                    const getColorClasses = (s) => {
                      if (s >= 6.5) return { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-200', lightBg: 'bg-green-50' };
                      if (s >= 5.0) return { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', lightBg: 'bg-blue-50' };
                      return { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', lightBg: 'bg-amber-50' };
                    };
                    const colors = getColorClasses(score);
                    
                    return feedback.scores?.[key] !== undefined && (
                      <div key={key} className={`bg-white border-2 ${colors.border} rounded-2xl p-5 shadow-md hover:shadow-lg transition-all`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-8 h-8 ${colors.lightBg} ${colors.text} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 leading-tight">{label}</p>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                          <p className="text-4xl font-black text-slate-900">{score}</p>
                          <p className="text-xs font-bold text-slate-400 mb-1">/ 9.0</p>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${colors.bg} rounded-full transition-all duration-700 ease-out`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
            </div>

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

                <button
                    onClick={() => { window.location.href = '/dashboard' }}
                    className="w-full px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    Return to Dashboard
                </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Main test interface
  const allPartsComplete = assignedParts.every(part => completedParts[part])
  const currentPartComplete = completedParts[currentPart]

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 font-sans overflow-x-hidden">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="flex items-center justify-between border-b border-slate-200 pb-8">
            <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-600">IELTS Speaking Test</p>
                <h1 className="text-4xl font-black tracking-tighter text-slate-950">Part {currentPart} of {assignedParts.length}</h1>
            </div>
            <button
                onClick={() => { window.location.href = '/dashboard' }}
                className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all hover:bg-slate-50 uppercase tracking-widest"
            >
                Dashboard
            </button>
        </header>

        {/* Progress Indicator */}
        <div className="flex items-center gap-3">
          {assignedParts.map((part, idx) => (
            <div key={part} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-black text-sm ${
                completedParts[part] ? 'bg-green-500 text-white' :
                idx === currentPartIndex ? 'bg-indigo-600 text-white' :
                'bg-slate-200 text-slate-400'
              }`}>
                {completedParts[part] ? '✓' : part}
              </div>
              {idx < assignedParts.length - 1 && (
                <div className={`h-1 w-12 rounded ${completedParts[part] ? 'bg-green-500' : 'bg-slate-200'}`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Part 1: Interview */}
        {currentPart === '1' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Part 1: Introduction & Interview</h2>
                <span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs">
                  Question {part1QuestionIndex + 1} of {part1Questions.length}
                </span>
              </div>
              
              <div className="space-y-4">
                {part1Questions.map((q, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border-2 transition-all ${
                    idx === part1QuestionIndex ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50 opacity-60'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === part1QuestionIndex ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <p className={`text-sm font-medium leading-relaxed ${
                        idx === part1QuestionIndex ? 'text-slate-900' : 'text-slate-500'
                      }`}>
                        {q}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPart1QuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={part1QuestionIndex === 0}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPart1QuestionIndex(prev => Math.min(part1Questions.length - 1, prev + 1))}
                  disabled={part1QuestionIndex === part1Questions.length - 1}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Part 2: Cue Card */}
        {currentPart === '2' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6">Part 2: Long Turn (Cue Card)</h2>
              
              {!part2PrepComplete ? (
                <div className="text-center space-y-6">
                  <div className={`text-6xl font-black ${part2PrepTime <= 10 ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`}>
                    {formatTime(part2PrepTime)}
                  </div>
                  <p className="text-lg font-bold text-slate-600">Preparation Time</p>
                  <p className="text-sm text-slate-500">You have 1 minute to prepare. You may take notes.</p>
                  <button
                    onClick={handleSkipPrep}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest"
                  >
                    Skip Preparation
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6">
                    <p className="text-xl font-bold text-slate-900 mb-4">{part2CueCard.prompt}</p>
                    <p className="text-sm font-bold text-slate-600 mb-3">You should say:</p>
                    <ul className="space-y-2">
                      {part2CueCard.points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-indigo-600 font-bold">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {isRecording && (
                    <div className="text-center">
                      <div className={`text-4xl font-black ${part2RecordTime <= 30 ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`}>
                        {formatTime(part2RecordTime)}
                      </div>
                      <p className="text-sm text-slate-500 mt-2">Recording Time Remaining</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Part 3: Discussion */}
        {currentPart === '3' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Part 3: Two-Way Discussion</h2>
                <div className={`px-4 py-2 rounded-xl font-bold text-xs ${
                  part3TimeRemaining <= 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600'
                }`}>
                  Time: {formatTime(part3TimeRemaining)}
                </div>
              </div>
              
              <div className="space-y-4">
                {part3Questions.map((q, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border-2 transition-all ${
                    idx === part3QuestionIndex ? 'border-purple-500 bg-purple-50/50' : 'border-slate-200 bg-slate-50/50 opacity-60'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === part3QuestionIndex ? 'bg-purple-600 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <p className={`text-sm font-medium leading-relaxed ${
                        idx === part3QuestionIndex ? 'text-slate-900' : 'text-slate-500'
                      }`}>
                        {q}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPart3QuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={part3QuestionIndex === 0}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPart3QuestionIndex(prev => Math.min(part3Questions.length - 1, prev + 1))}
                  disabled={part3QuestionIndex === part3Questions.length - 1}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Recording Interface */}
        {(currentPart === '1' || currentPart === '3' || (currentPart === '2' && part2PrepComplete)) && (
          <section className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
            
            <div className="relative flex flex-col items-center gap-10">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        {isRecording && (
                            <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping scale-150"></div>
                        )}
                        <button
                            onClick={handleToggleRecording}
                            disabled={currentPartComplete}
                            className={`relative w-20 h-20 rounded-full border-4 border-slate-800 flex items-center justify-center transition-all transform active:scale-95 group shadow-inner ${
                                isRecording ? 'bg-white' : currentPartComplete ? 'bg-green-500' : 'bg-slate-800 hover:bg-slate-700 hover:border-slate-600'
                            }`}
                        >
                            {currentPartComplete ? (
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            ) : isRecording ? (
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
                        <p className={`text-sm font-black uppercase tracking-[0.2em] ${
                          currentPartComplete ? 'text-green-400' : isRecording ? 'text-red-400' : 'text-slate-400'
                        }`}>
                            {currentPartComplete ? 'Part Complete' : isRecording ? 'Recording Live' : 'Standby'}
                        </p>
                        <p className={`text-4xl font-black tabular-nums transition-all ${isRecording ? 'text-white' : 'text-slate-500'}`}>
                            {formatTime(recordingSeconds)}
                        </p>
                    </div>
                </div>

                {currentPartComplete && !allPartsComplete && (
                  <button
                      onClick={handleNextPart}
                      className="w-full max-w-sm py-5 bg-white hover:bg-slate-50 font-black uppercase tracking-widest text-xs rounded-2xl text-slate-900 shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
                  >
                      Continue to Part {assignedParts[currentPartIndex + 1]}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </button>
                )}

                {allPartsComplete && (
                  <button
                      onClick={handleSubmitAll}
                      disabled={isSubmitting}
                      className="w-full max-w-sm py-5 bg-white hover:bg-slate-50 disabled:bg-slate-800/50 disabled:text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl text-slate-900 shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
                  >
                      {isSubmitting ? (
                          <>
                              <div className="w-4 h-4 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                              Analyzing Audio...
                          </>
                      ) : (
                          <>
                              Submit for Evaluation
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          </>
                      )}
                  </button>
                )}
            </div>
        </section>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </main>
  )
}
