import { useState, useEffect, useRef } from 'react'
import { Mic, Volume2, RotateCcw, ArrowRight, Play, AlertCircle, CheckCircle } from 'lucide-react'

// Part 1 Questions Pool - Organized by Topic
const PART_1_TOPICS = [
  {
    topic: "Hometown & Living",
    questions: [
      "Where are you from? Can you describe your hometown?",
      "What do you like most about your hometown?",
      "Has your hometown changed much since you were a child?",
      "Would you like to live there in the future? Why or why not?",
      "Do you prefer living in a city or in the countryside?"
    ]
  },
  {
    topic: "Work & Studies",
    questions: [
      "Do you work or are you a student?",
      "What do you study? / What is your job?",
      "Why did you choose this field of study / career?",
      "What do you find most interesting about your work or studies?",
      "What are your future career plans?"
    ]
  },
  {
    topic: "Hobbies & Free Time",
    questions: [
      "What do you like to do in your free time?",
      "How do you usually spend your weekends?",
      "Have your hobbies changed since you were a child?",
      "Is there a hobby you would like to try in the future?",
      "Do you prefer indoor or outdoor activities?"
    ]
  },
  {
    topic: "Family & Friends",
    questions: [
      "Do you have a large or small family?",
      "How much time do you spend with your family?",
      "Do you prefer to spend time with family or friends? Why?",
      "What activities do you enjoy doing with your family?",
      "Are you still in touch with friends from your childhood?"
    ]
  },
  {
    topic: "Music & Entertainment",
    questions: [
      "What kind of music do you enjoy listening to?",
      "Do you play any musical instruments?",
      "How often do you listen to music?",
      "Have your music tastes changed over the years?",
      "Do you prefer listening to music alone or with others?"
    ]
  }
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
const PART_3_TOPICS = [
  {
    topic: "Technology and Society",
    questions: [
      "How has technology changed the way people communicate in your country?",
      "Do you think people rely too much on technology these days?",
      "What are the potential dangers of artificial intelligence?",
      "How might technology change education in the next 20 years?"
    ]
  },
  {
    topic: "Environmental Issues",
    questions: [
      "What role should governments play in protecting the environment?",
      "Do you think individuals can make a real difference in fighting climate change?",
      "Should companies be forced to reduce their carbon emissions?",
      "How can we encourage people to adopt more sustainable lifestyles?"
    ]
  },
  {
    topic: "Education and Learning",
    questions: [
      "How do you think education systems could be improved globally?",
      "Is university education necessary for success in modern society?",
      "Should students be allowed to choose all their own subjects?",
      "What is the role of teachers in the age of online learning?"
    ]
  }
]

export default function App() {
  useEffect(() => { document.documentElement.classList.remove('dark') }, [])

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

  // Assignment metadata
  const [assignedParts, setAssignedParts] = useState(['1', '2', '3'])
  
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

  // Content selection
  const [part1Topic] = useState(() => PART_1_TOPICS[Math.floor(Math.random() * PART_1_TOPICS.length)])
  const [part1Questions] = useState(() => part1Topic.questions)
  const [part2CueCard] = useState(() => PART_2_CUE_CARDS[Math.floor(Math.random() * PART_2_CUE_CARDS.length)])
  const [part3Topic] = useState(() => PART_3_TOPICS[Math.floor(Math.random() * PART_3_TOPICS.length)])
  const [part3Questions] = useState(() => part3Topic.questions)

  // State machine: 'intro' | 'part1' | 'break1' | 'part2_prep' | 'part2_record' | 'break2' | 'part3' | 'break3' | 'complete' | 'feedback'
  const [phase, setPhase] = useState('intro')
  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  
  // Part 1 & 3 domino state
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [repeatUsesLeft, setRepeatUsesLeft] = useState(2)
  const [audioBlobs, setAudioBlobs] = useState([]) // Array of {part, questionIdx, blob}
  
  // Part 2 state
  const [part2PrepTime, setPart2PrepTime] = useState(60)
  const [part2PrepComplete, setPart2PrepComplete] = useState(false)
  const [part2RecordTime, setPart2RecordTime] = useState(120)
  
  // Recording refs
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const speechSynthRef = useRef(null)
  
  // Mic permission
  const [micPermission, setMicPermission] = useState(null) // null | 'granted' | 'denied'
  const [error, setError] = useState('')
  
  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  // ── Mic Permission Check ────────────────────────────────────────────────────
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setMicPermission('granted')
      setError('')
    } catch (err) {
      setMicPermission('denied')
      setError('Microphone access denied. Please allow microphone permissions in your browser settings.')
    }
  }

  // ── Audio Playback (Web Speech API) ────────────────────────────────────────
  const playQuestionAudio = (questionText, onEnd) => {
    window.speechSynthesis.cancel()
    setIsPlayingAudio(true)
    const utterance = new SpeechSynthesisUtterance(questionText)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.onend = () => {
      setIsPlayingAudio(false)
      if (onEnd) onEnd()
    }
    speechSynthRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  // ── Recording ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError('')
    audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const currentPart = assignedParts[currentPartIndex]
        setAudioBlobs(prev => [...prev, { part: currentPart, questionIdx: currentQuestionIdx, blob }])
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start(250)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  // ── Domino Flow: Part 1 & 3 ────────────────────────────────────────────────
  const handleDominoNext = () => {
    stopRecording()
    const currentPart = assignedParts[currentPartIndex]
    const questions = currentPart === '1' ? part1Questions : part3Questions
    
    if (currentQuestionIdx < questions.length - 1) {
      // Next question in same part
      setCurrentQuestionIdx(prev => prev + 1)
      setRepeatUsesLeft(2)
      setTimeout(() => {
        playQuestionAudio(questions[currentQuestionIdx + 1], () => startRecording())
      }, 500)
    } else {
      // Part complete
      if (currentPart === '1' && assignedParts.includes('2')) {
        setPhase('break1')
      } else if (currentPart === '1' && assignedParts.includes('3')) {
        setPhase('break2')
      } else if (currentPart === '3') {
        setPhase('break3')
      } else {
        setPhase('complete')
      }
    }
  }

  const handleRepeatQuestion = () => {
    if (repeatUsesLeft <= 0) return
    stopRecording()
    // Discard last blob for this question
    setAudioBlobs(prev => prev.filter((item, idx) => idx !== prev.length - 1))
    setRepeatUsesLeft(prev => prev - 1)
    const currentPart = assignedParts[currentPartIndex]
    const questions = currentPart === '1' ? part1Questions : part3Questions
    setTimeout(() => {
      playQuestionAudio(questions[currentQuestionIdx], () => startRecording())
    }, 300)
  }

  // ── Part 2 Prep Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'part2_prep' && part2PrepTime > 0) {
      const timer = setInterval(() => {
        setPart2PrepTime(prev => {
          if (prev <= 1) {
            setPart2PrepComplete(true)
            setPhase('part2_record')
            setTimeout(() => startRecording(), 500)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [phase, part2PrepTime])

  // ── Part 2 Record Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'part2_record' && isRecording && part2RecordTime > 0) {
      const timer = setInterval(() => {
        setPart2RecordTime(prev => {
          if (prev <= 1) {
            stopRecording()
            if (assignedParts.includes('3')) {
              setPhase('break2')
            } else {
              setPhase('break3')
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [phase, isRecording, part2RecordTime])

  // ── Phase Transitions ───────────────────────────────────────────────────────
  const startPart1 = () => {
    setPhase('part1')
    setCurrentPartIndex(0)
    setCurrentQuestionIdx(0)
    setRepeatUsesLeft(2)
    setTimeout(() => {
      playQuestionAudio(part1Questions[0], () => startRecording())
    }, 1000)
  }

  const startPart2 = () => {
    setPhase('part2_prep')
    setCurrentPartIndex(assignedParts.indexOf('2'))
    setPart2PrepTime(60)
    setPart2PrepComplete(false)
    setPart2RecordTime(120)
  }

  const startPart3 = () => {
    setPhase('part3')
    setCurrentPartIndex(assignedParts.indexOf('3'))
    setCurrentQuestionIdx(0)
    setRepeatUsesLeft(2)
    setTimeout(() => {
      playQuestionAudio(part3Questions[0], () => startRecording())
    }, 1000)
  }

  const handleSkipPrep = () => {
    setPart2PrepComplete(true)
    setPart2PrepTime(0)
    setPhase('part2_record')
    setTimeout(() => startRecording(), 500)
  }

  // ── Submission ──────────────────────────────────────────────────────────────
  const handleSubmitAll = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com')
      const formData = new FormData()
      
      audioBlobs.forEach((item, idx) => {
        formData.append('audio', item.blob, `part${item.part}_q${item.questionIdx}.webm`)
      })

      formData.append('prompt', `IELTS Speaking Test - Parts: ${assignedParts.join(', ')}`)
      formData.append('part', assignedParts.join(','))

      const response = await fetch(`${apiBase}/api/ielts/evaluate`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Server responded with ${response.status}`)
      }

      const result = await response.json()
      setFeedback(result)
      setPhase('feedback')
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
            <AlertCircle size={48} />
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

  // ══════════════════════════════════════════════════════════════════════════
  // FEEDBACK SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'feedback' && feedback) {
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
              <div className="bg-slate-900 text-white rounded-[2rem] p-12 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-50"></div>
                <p className="relative text-xs font-black uppercase tracking-[0.25em] mb-6 text-indigo-300">Overall Band Score</p>
                <div className="relative text-[8rem] font-black leading-none mb-4">{feedback.scores?.overall ?? '—'}</div>
                <p className="relative text-lg font-medium text-slate-400">Out of 9.0</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Fluency', key: 'fluency' },
                  { label: 'Lexical', key: 'lexical' },
                  { label: 'Grammar', key: 'grammar' },
                  { label: 'Pronunciation', key: 'pronunciation' },
                ].map(({ label, key }) => {
                  const score = feedback.scores?.[key] ?? 0
                  const percentage = (score / 9) * 100
                  return feedback.scores?.[key] !== undefined && (
                    <div key={key} className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-md">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">{label}</p>
                      <p className="text-4xl font-black text-slate-900 mb-2">{score}</p>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
                {feedback.feedback?.strengths && (
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-green-600 mb-2">Strengths</h3>
                    <p className="text-slate-600 leading-relaxed">{feedback.feedback.strengths}</p>
                  </div>
                )}
                {feedback.feedback?.weaknesses && (
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-600 mb-2">Areas to Improve</h3>
                    <p className="text-slate-600 leading-relaxed">{feedback.feedback.weaknesses}</p>
                  </div>
                )}
                {feedback.feedback?.improvement_tip && (
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600 mb-2">Recommendation</h3>
                    <p className="text-slate-600 leading-relaxed">{feedback.feedback.improvement_tip}</p>
                  </div>
                )}
              </div>

              {/* Grammar Errors Section */}
              {Array.isArray(feedback.grammar_errors) && feedback.grammar_errors.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-red-600">Specific Grammar Errors</h3>
                  <div className="space-y-3">
                    {feedback.grammar_errors.map((err, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-700 text-white text-[10px] font-black w-5 h-5 rounded flex items-center justify-center">{idx + 1}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{err.category}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                            <p className="text-[9px] font-black uppercase text-red-400 mb-1">✕ You said</p>
                            <p className="text-sm text-red-800 italic">"{err.heard}"</p>
                          </div>
                          <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                            <p className="text-[9px] font-black uppercase text-green-500 mb-1">✓ Better</p>
                            <p className="text-sm text-green-800">"{err.correction}"</p>
                          </div>
                        </div>
                        {err.explanation && (
                          <p className="text-xs text-slate-500 pl-1">💡 {err.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { window.location.href = '/dashboard' }}
                className="w-full px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl transition-all"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN TEST INTERFACE
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="flex items-center justify-between border-b border-slate-200 pb-8">
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-600">IELTS Speaking Test</p>
            <h1 className="text-4xl font-black tracking-tighter text-slate-950">
              {phase === 'intro' && 'Get Ready'}
              {phase === 'part1' && 'Part 1: Interview'}
              {phase === 'break1' && 'Break'}
              {phase === 'part2_prep' && 'Part 2: Preparation'}
              {phase === 'part2_record' && 'Part 2: Long Turn'}
              {phase === 'break2' && 'Break'}
              {phase === 'part3' && 'Part 3: Discussion'}
              {phase === 'break3' && 'Test Complete'}
              {phase === 'complete' && 'Test Complete'}
            </h1>
          </div>
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all hover:bg-slate-50 uppercase tracking-widest"
          >
            Dashboard
          </button>
        </header>

        {/* ── INTRO SCREEN ── */}
        {phase === 'intro' && (
          <section className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Mic size={32} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Welcome to the Speaking Test</h2>
                  <p className="text-sm text-slate-500 mt-1">Parts: {assignedParts.join(', ')}</p>
                </div>
              </div>

              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-900">How this test works:</p>
                <ul className="space-y-2 pl-5">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold mt-1">•</span>
                    <span>The examiner will ask you questions via <strong>audio playback</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold mt-1">•</span>
                    <span>Your microphone will <strong>automatically start recording</strong> when the question ends.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold mt-1">•</span>
                    <span>Click <strong>"Stop & Next"</strong> when you finish answering to move to the next question.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold mt-1">•</span>
                    <span>You can use <strong>"Repeat Question"</strong> up to 2 times per task.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold mt-1">•</span>
                    <span><strong>No pausing</strong> during active questions — this simulates real exam pressure.</span>
                  </li>
                </ul>
              </div>

              {micPermission === null && (
                <button
                  onClick={requestMicPermission}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3"
                >
                  <Mic size={20} />
                  Grant Microphone Access
                </button>
              )}

              {micPermission === 'granted' && (
                <button
                  onClick={startPart1}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3"
                >
                  <Play size={20} />
                  Start Test
                </button>
              )}

              {micPermission === 'denied' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium flex items-center gap-3">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── PART 1 ── */}
        {phase === 'part1' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Part 1: Introduction & Interview</h2>
                  <p className="text-xs text-slate-400 mt-1">Topic: {part1Topic.topic}</p>
                </div>
                <span className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold text-xs">
                  Question {currentQuestionIdx + 1} of {part1Questions.length}
                </span>
              </div>

              {isPlayingAudio && (
                <div className="flex items-center justify-center gap-4 py-12">
                  <Volume2 size={32} className="text-indigo-600 animate-pulse" />
                  <p className="text-lg font-bold text-slate-700">Examiner is speaking...</p>
                </div>
              )}

              {isRecording && !isPlayingAudio && (
                <div className="text-center py-12 space-y-6">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping scale-150"></div>
                    <div className="relative w-20 h-20 bg-red-500 rounded-full flex items-center justify-center">
                      <Mic size={40} className="text-white" />
                    </div>
                  </div>
                  <p className="text-xl font-black text-slate-900">Recording Your Answer</p>
                  <p className="text-sm text-slate-500">Speak naturally. Click "Stop & Next" when finished.</p>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={handleDominoNext}
                      className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center gap-2"
                    >
                      Stop & Next
                      <ArrowRight size={18} />
                    </button>

                    <button
                      onClick={handleRepeatQuestion}
                      disabled={repeatUsesLeft === 0}
                      className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      title={`${repeatUsesLeft} uses left`}
                    >
                      <RotateCcw size={16} />
                      Repeat ({repeatUsesLeft})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── BREAK 1 (after Part 1, before Part 2) ── */}
        {phase === 'break1' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm text-center space-y-6">
              <CheckCircle size={64} className="text-green-500 mx-auto" />
              <div>
                <h2 className="text-2xl font-black text-slate-900">Part 1 Complete</h2>
                <p className="text-slate-500 mt-2">Take a moment to breathe. When ready, start Part 2.</p>
              </div>
              <button
                onClick={startPart2}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all"
              >
                Start Part 2
              </button>
            </div>
          </section>
        )}

        {/* ── PART 2 PREP ── */}
        {phase === 'part2_prep' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6">Part 2: Long Turn (Cue Card)</h2>
              
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 mb-6">
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
            </div>
          </section>
        )}

        {/* ── PART 2 RECORD ── */}
        {phase === 'part2_record' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6">Part 2: Long Turn</h2>
              
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 mb-6">
                <p className="text-xl font-bold text-slate-900 mb-4">{part2CueCard.prompt}</p>
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
                <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping scale-150"></div>
                    <div className="relative w-20 h-20 bg-red-500 rounded-full flex items-center justify-center">
                      <Mic size={40} className="text-white" />
                    </div>
                  </div>
                  <div className={`text-4xl font-black ${part2RecordTime <= 30 ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`}>
                    {formatTime(part2RecordTime)}
                  </div>
                  <p className="text-sm text-slate-500">Recording Time Remaining (Auto-stops at 2 minutes)</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── BREAK 2 (after Part 2, before Part 3) ── */}
        {phase === 'break2' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm text-center space-y-6">
              <CheckCircle size={64} className="text-green-500 mx-auto" />
              <div>
                <h2 className="text-2xl font-black text-slate-900">Part 2 Complete</h2>
                <p className="text-slate-500 mt-2">Take a moment to breathe. When ready, start Part 3.</p>
              </div>
              <button
                onClick={startPart3}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all"
              >
                Start Part 3
              </button>
            </div>
          </section>
        )}

        {/* ── PART 3 ── */}
        {phase === 'part3' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Part 3: Two-Way Discussion</h2>
                  <p className="text-xs text-slate-400 mt-1">Topic: {part3Topic.topic}</p>
                </div>
                <span className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold text-xs">
                  Question {currentQuestionIdx + 1} of {part3Questions.length}
                </span>
              </div>

              {isPlayingAudio && (
                <div className="flex items-center justify-center gap-4 py-12">
                  <Volume2 size={32} className="text-indigo-600 animate-pulse" />
                  <p className="text-lg font-bold text-slate-700">Examiner is speaking...</p>
                </div>
              )}

              {isRecording && !isPlayingAudio && (
                <div className="text-center py-12 space-y-6">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping scale-150"></div>
                    <div className="relative w-20 h-20 bg-red-500 rounded-full flex items-center justify-center">
                      <Mic size={40} className="text-white" />
                    </div>
                  </div>
                  <p className="text-xl font-black text-slate-900">Recording Your Answer</p>
                  <p className="text-sm text-slate-500">Speak naturally. Click "Stop & Next" when finished.</p>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={handleDominoNext}
                      className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center gap-2"
                    >
                      Stop & Next
                      <ArrowRight size={18} />
                    </button>

                    <button
                      onClick={handleRepeatQuestion}
                      disabled={repeatUsesLeft === 0}
                      className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      title={`${repeatUsesLeft} uses left`}
                    >
                      <RotateCcw size={16} />
                      Repeat ({repeatUsesLeft})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── BREAK 3 / COMPLETE ── */}
        {(phase === 'break3' || phase === 'complete') && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm text-center space-y-6">
              <CheckCircle size={64} className="text-green-500 mx-auto" />
              <div>
                <h2 className="text-2xl font-black text-slate-900">Test Complete!</h2>
                <p className="text-slate-500 mt-2">All parts finished. Submit your recording for AI evaluation.</p>
              </div>
              <button
                onClick={handleSubmitAll}
                disabled={isSubmitting}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 mx-auto"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    Analyzing Audio...
                  </>
                ) : (
                  <>
                    Submit for Evaluation
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium flex items-center gap-3">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </main>
  )
}
