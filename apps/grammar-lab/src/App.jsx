import { useEffect, useMemo, useState } from 'react'

const topicModules = import.meta.glob('./data/*.json', { eager: true })

function parseTopicIdFromQuery() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('topicId') || '01_article_usage'
  try {
    // Safely handle encoded multi-word topics (e.g. Article%20Usage)
    return decodeURIComponent(raw).trim().toLowerCase()
  } catch (e) {
    return raw.trim().toLowerCase()
  }
}

function sampleQuestions(questionBank, count = 10) {
  const shuffled = [...questionBank]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function resolveTopic(topicId) {
  const entries = Object.entries(topicModules).map(([path, mod]) => ({
    path,
    data: mod.default || mod,
  }))

  // 1. Try exact filename match (e.g. 01_article_usage)
  const exactPath = entries.find(({ path }) => path.endsWith(`/${topicId}.json`))
  if (exactPath) return exactPath.data

  // 2. Try matching against the internal topicId property
  const byTopicId = entries.find(({ data }) => String(data?.topicId || '').toLowerCase() === topicId)
  if (byTopicId) return byTopicId.data

  // 3. Try matching against the student-facing topicName (e.g. "Article Usage" -> "article usage")
  const byTopicName = entries.find(({ data }) => String(data?.topicName || '').toLowerCase().trim() === topicId)
  if (byTopicName) return byTopicName.data

  const fallback = entries.find(({ path }) => path.endsWith('/01_article_usage.json'))
  return fallback?.data || null
}

const PASS_THRESHOLD = 80

export default function App() {
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com')

  // Forced Theme: Remove dark mode for Grammar Lab
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  const [topicId] = useState(parseTopicIdFromQuery)
  const topic = useMemo(() => resolveTopic(topicId), [topicId])

  const levelOptions = topic?.levels || []
  const [activeLevel, setActiveLevel] = useState(() => levelOptions[0]?.level || 1)
  const [progressError, setProgressError] = useState('')
  const [isProgressLoading, setIsProgressLoading] = useState(true)
  const [isSavingProgress, setIsSavingProgress] = useState(false)
  const [grammarProgress, setGrammarProgress] = useState(null)
  const [lastSavedPassKey, setLastSavedPassKey] = useState('')

  const selectedLevelData = useMemo(
    () => levelOptions.find((entry) => Number(entry.level) === Number(activeLevel)) || null,
    [levelOptions, activeLevel]
  )

  const [quizSeed, setQuizSeed] = useState(0)
  const quizQuestions = useMemo(() => {
    if (!selectedLevelData?.questionBank) return []
    return sampleQuestions(selectedLevelData.questionBank, 10)
  }, [selectedLevelData, quizSeed])

  const [answersById, setAnswersById] = useState({})

  useEffect(() => {
    if (levelOptions.length > 0 && !levelOptions.some((entry) => Number(entry.level) === Number(activeLevel))) {
      setActiveLevel(levelOptions[0].level)
    }
  }, [levelOptions, activeLevel])

  useEffect(() => {
    const fetchProgress = async () => {
      if (!topic?.topicName) {
        setIsProgressLoading(false)
        return
      }

      const token = localStorage.getItem('token')
      if (!token) {
        setGrammarProgress(null)
        setIsProgressLoading(false)
        return
      }

      try {
        setIsProgressLoading(true)
        setProgressError('')
        const res = await fetch(`${apiBase}/api/grammar-progress/my-progress`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load grammar progress')

        const entry = (data.progress || []).find((item) => item.error_category === topic.topicName) || null
        setGrammarProgress(entry)
      } catch (error) {
        setProgressError(error.message || 'Unable to load saved grammar progress')
      } finally {
        setIsProgressLoading(false)
      }
    }

    fetchProgress()
  }, [apiBase, topic?.topicName])

  const unlockedLevelCap = useMemo(() => {
    const currentLevel = Number(grammarProgress?.current_level || 1)
    return Math.max(1, Math.min(4, currentLevel))
  }, [grammarProgress])

  const isLevelUnlocked = (level) => Number(level) <= unlockedLevelCap

  const handleLevelChange = (level) => {
    if (!isLevelUnlocked(level)) return
    setActiveLevel(level)
    setAnswersById({})
    setHasSubmitted(false)
    setQuizSeed((prev) => prev + 1)
  }

  const handleSelect = (questionId, optionValue) => {
    setAnswersById((prev) => ({ ...prev, [questionId]: optionValue }))
  }

  const [hasSubmitted, setHasSubmitted] = useState(false)
  const answeredCount = quizQuestions.filter((question) => typeof answersById[question.id] === 'string').length
  const totalQuestions = quizQuestions.length
  const isQuizComplete = totalQuestions > 0 && answeredCount === totalQuestions && hasSubmitted
  const correctCount = quizQuestions.reduce((count, question) => {
    return count + (answersById[question.id] === question.correctAnswer ? 1 : 0)
  }, 0)
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const hasPassedLevel = isQuizComplete && scorePercent >= PASS_THRESHOLD
  const nextLevel = Number(activeLevel) + 1
  const hasNextLevel = levelOptions.some((entry) => Number(entry.level) === nextLevel)

  const handleSubmitQuiz = () => {
    setHasSubmitted(true)
  }

  const handleRetakeQuiz = () => {
    setAnswersById({})
    setHasSubmitted(false)
    setQuizSeed((prev) => prev + 1)
  }

  const savePassedLevel = async (levelNumber) => {
    const token = localStorage.getItem('token')
    if (!token || !topic?.topicName) return

    try {
      setIsSavingProgress(true)
      setProgressError('')
      const res = await fetch(`${apiBase}/api/grammar-progress/my-progress/pass-level`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          error_category: topic.topicName,
          passed_level: levelNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save grammar progress')
      if (data.progress_entry) {
        setGrammarProgress(data.progress_entry)
      }
    } catch (error) {
      setProgressError(error.message || 'Unable to save grammar progress')
    } finally {
      setIsSavingProgress(false)
    }
  }

  useEffect(() => {
    if (!hasPassedLevel || !topic?.topicName) return

    const passKey = `${topic.topicName}:${activeLevel}:${quizSeed}`
    if (lastSavedPassKey === passKey) return
    setLastSavedPassKey(passKey)

    setGrammarProgress((prev) => {
      const previousLevel = Number(prev?.current_level || 1)
      return {
        ...(prev || { error_category: topic.topicName, exercises_completed: 0 }),
        current_level: Math.max(previousLevel, Number(activeLevel) + 1),
        passed_levels: Array.from(new Set([...(prev?.passed_levels || []), Number(activeLevel)])).sort((a, b) => a - b),
      }
    })

    savePassedLevel(Number(activeLevel))
  }, [hasPassedLevel, topic?.topicName, activeLevel, quizSeed, lastSavedPassKey])

  if (!topic) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-10 md:px-6">
        <div className="max-w-3xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-8 shadow-sm">
          <h1 className="text-2xl font-black mb-3">Topic not found</h1>
          <p className="text-slate-600 dark:text-slate-400">Could not load topic ID <span className="font-mono">{topicId}</span>.</p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-3 italic tracking-tight">Try specifying a valid <span className="font-mono">?topicId=</span> parameter.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-[#0A1930] text-slate-900 dark:text-slate-100 px-4 py-8 md:px-6 md:py-10 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            ← Back to Dashboard
          </button>
        </div>

        <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] font-black text-slate-500 dark:text-slate-400 mb-2">Grammar Player</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">{topic.topicName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Complete each level quiz with at least 80% to unlock the next level.</p>
        </section>

        <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm">
          <h2 className="text-xs uppercase tracking-[0.16em] font-black text-slate-500 dark:text-slate-400 mb-4">Choose Level</h2>
          <div className="flex flex-wrap gap-2">
            {levelOptions.map((level) => {
              const levelNumber = Number(level.level)
              const isUnlocked = isLevelUnlocked(levelNumber)
              const isActive = Number(level.level) === Number(activeLevel)
              return (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => handleLevelChange(level.level)}
                  disabled={!isUnlocked}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 dark:bg-amber-600 text-white border-slate-900 dark:border-amber-600 shadow-md transform scale-105'
                      : isUnlocked
                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                  }`}
                >
                  Level {level.level} {!isUnlocked ? '• Locked' : ''}
                </button>
              )
            })}
          </div>
          {(isProgressLoading || isSavingProgress) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              Syncing grammar progress...
            </p>
          )}
          {progressError && <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-bold">⚠️ {progressError}</p>}
        </section>

        {selectedLevelData && (
          <div className="space-y-6">
            <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Level {selectedLevelData.level}: {selectedLevelData.title}</h2>
                <button
                  type="button"
                  onClick={handleRetakeQuiz}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 shadow-sm"
                >
                  Shuffle 10 Questions
                </button>
              </div>
              <div
                className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-slate-600 dark:prose-p:text-slate-300"
                // Content is loaded from local bundled JSON files controlled in-repo.
                dangerouslySetInnerHTML={{ __html: selectedLevelData.miniLesson || '' }}
              />
            </section>

            <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 opacity-20"></div>
              <h2 className="text-xs uppercase tracking-[0.16em] font-black text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Quiz (10 Questions)
              </h2>
              {isQuizComplete ? (
                <div className="space-y-8">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-6 md:p-8 text-center sm:text-left relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-24 h-24 blur-2xl opacity-10 rounded-full -mr-8 -mt-8 ${hasPassedLevel ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Quiz Complete</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">Your score: <span className="font-black text-slate-900 dark:text-white text-xl">{correctCount}/{totalQuestions}</span> ({scorePercent}%)</p>
                    <p className={`text-sm font-black mt-4 px-4 py-2 rounded-lg inline-block ${hasPassedLevel ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
                      {hasPassedLevel
                        ? '✨ Great work! You unlocked the next level.'
                        : '💡 Score 80% or higher to unlock the next level.'}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 mt-8">
                      <button
                        type="button"
                        onClick={handleRetakeQuiz}
                        className="px-6 py-3 rounded-xl text-sm font-bold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-all shadow-sm"
                      >
                        Try Again
                      </button>

                      {hasPassedLevel && hasNextLevel && (
                        <button
                          type="button"
                          onClick={() => handleLevelChange(nextLevel)}
                          className="px-6 py-3 rounded-xl text-sm font-bold border border-slate-900 dark:border-amber-600 bg-slate-900 dark:bg-amber-600 text-white hover:bg-black dark:hover:bg-amber-700 transition-all shadow-lg"
                        >
                          Next Level →
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { window.location.href = '/dashboard' }}
                        className="px-6 py-3 rounded-xl text-sm font-bold border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-900 dark:text-indigo-400 transition-all"
                      >
                        Dashboard
                      </button>
                    </div>
                  </div>

                  {/* Review Your Answers Section */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/20 p-6 md:p-8">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">Review Your Answers</h3>
                    <div className="space-y-8">
                      {quizQuestions.map((question, index) => {
                        const selectedAnswer = answersById[question.id]
                        const correctAnswer = question.correctAnswer
                        const isCorrect = selectedAnswer === correctAnswer

                        return (
                          <article key={question.id} className={`border-2 rounded-2xl p-6 transition-all ${isCorrect ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'}`}>
                            {/* Question Number and Status */}
                            <div className="flex items-center justify-between mb-5">
                              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Question {index + 1}</h4>
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isCorrect ? 'bg-green-600 dark:bg-green-500 text-white shadow-glow-green' : 'bg-red-600 dark:bg-red-500 text-white shadow-glow-red'}`}>
                                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                              </span>
                            </div>

                            {/* Original Sentence/Question */}
                            <div className="mb-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Original Sentence:</p>
                              <p className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{question.question}</p>
                            </div>

                            {/* Student's Answer */}
                            <div className="mb-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Your Answer:</p>
                              <div className={`px-5 py-3 rounded-xl border-2 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'}`}>
                                <p className={`font-black text-base ${isCorrect ? 'text-green-900 dark:text-green-400' : 'text-red-900 dark:text-red-400'}`}>{selectedAnswer}</p>
                              </div>
                            </div>

                            {/* Correct Answer (if wrong) */}
                            {!isCorrect && (
                              <div className="mb-5 scale-95 origin-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Correct Answer:</p>
                                <div className="px-5 py-3 rounded-xl border-2 bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-800">
                                  <p className="font-black text-base text-green-900 dark:text-green-400">{correctAnswer}</p>
                                </div>
                              </div>
                            )}

                            {/* Explanation/Rationale */}
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                              <p className="text-[10px] font-black uppercase tracking-widest text-brand-copper mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-brand-copper rounded-full"></span>
                                Grammar Rule Explanation
                              </p>
                              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium italic">{question.explanation}</p>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {quizQuestions.map((question, index) => {
                    const selectedAnswer = answersById[question.id]
                    const isAnswered = typeof selectedAnswer === 'string'
                    const correctAnswer = question.correctAnswer
                    const isCorrect = isAnswered && selectedAnswer === correctAnswer

                    return (
                      <article key={question.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50 dark:bg-slate-900/30 transition-all">
                        <h3 className="font-black text-slate-900 dark:text-white mb-6 text-lg leading-tight">{index + 1}. {question.question}</h3>

                        <fieldset className="space-y-3">
                          {question.options.map((option) => {
                            const inputId = `${question.id}-${option}`
                            const isSelected = selectedAnswer === option
                            return (
                              <label 
                                key={option} 
                                htmlFor={inputId} 
                                className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 cursor-pointer transition-all duration-200 ${
                                  isSelected 
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 dark:border-amber-600 ring-2 ring-amber-500/10' 
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected 
                                    ? 'border-amber-600 bg-amber-600' 
                                    : 'border-slate-300 dark:border-slate-600 bg-transparent'
                                }`}>
                                  {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                </div>
                                <input
                                  id={inputId}
                                  type="radio"
                                  name={question.id}
                                  value={option}
                                  checked={selectedAnswer === option}
                                  onChange={() => handleSelect(question.id, option)}
                                  className="hidden"
                                />
                                <span className={`text-base font-bold transition-colors ${isSelected ? 'text-amber-900 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{option}</span>
                              </label>
                            )
                          })}
                        </fieldset>

                        {hasSubmitted && isAnswered && (
                          <div className={`mt-5 rounded-xl border-2 p-4 animate-in slide-in-from-top-2 ${isCorrect ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'}`}>
                            <p className={`text-sm font-black uppercase tracking-widest ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                              {isCorrect ? '✓ Correct Result' : `✗ Incorrect (Correct: ${correctAnswer})`}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 font-medium italic">{question.explanation}</p>
                          </div>
                        )}
                      </article>
                    )
                  })}
                  {!hasSubmitted && answeredCount === totalQuestions && (
                    <div className="mt-10 flex justify-center">
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        className="px-8 py-4 bg-slate-900 dark:bg-amber-600 hover:bg-black dark:hover:bg-amber-700 text-white font-black uppercase tracking-widest text-sm rounded-2xl transition-all shadow-xl transform hover:scale-105 active:scale-95"
                      >
                        Submit Answers
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
