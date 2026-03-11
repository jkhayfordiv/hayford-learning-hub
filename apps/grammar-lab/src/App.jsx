import { useEffect, useMemo, useState } from 'react'

const topicModules = import.meta.glob('./data/*.json', { eager: true })

function parseTopicIdFromQuery() {
  const params = new URLSearchParams(window.location.search)
  return (params.get('topicId') || '01_article_usage').trim().toLowerCase()
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

  const exactPath = entries.find(({ path }) => path.endsWith(`/${topicId}.json`))
  if (exactPath) return exactPath.data

  const byTopicId = entries.find(({ data }) => String(data?.topicId || '').toLowerCase() === topicId)
  if (byTopicId) return byTopicId.data

  const fallback = entries.find(({ path }) => path.endsWith('/01_article_usage.json'))
  return fallback?.data || null
}

const PASS_THRESHOLD = 80

export default function App() {
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com')
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
      <main className="min-h-screen bg-slate-100 text-slate-900 px-4 py-10 md:px-6">
        <div className="max-w-3xl mx-auto rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black mb-3">Topic not found</h1>
          <p className="text-slate-600">Could not load topic ID <span className="font-mono">{topicId}</span>.</p>
          <p className="text-sm text-slate-500 mt-3">Try <span className="font-mono">?topicId=01_article_usage</span>.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 px-4 py-8 md:px-6 md:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] font-black text-slate-500 mb-2">Grammar Player</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">{topic.topicName}</h1>
          <p className="text-sm text-slate-500 mt-2">Complete each level quiz with at least 80% to unlock the next level.</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <h2 className="text-xs uppercase tracking-[0.16em] font-black text-slate-500 mb-4">Choose Level</h2>
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
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : isUnlocked
                        ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                >
                  Level {level.level} {!isUnlocked ? '• Locked' : ''}
                </button>
              )
            })}
          </div>
          {(isProgressLoading || isSavingProgress) && (
            <p className="text-xs text-slate-500 mt-3">Syncing grammar progress...</p>
          )}
          {progressError && <p className="text-xs text-red-600 mt-3">{progressError}</p>}
        </section>

        {selectedLevelData && (
          <>
            <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-black text-slate-900">Level {selectedLevelData.level}: {selectedLevelData.title}</h2>
                <button
                  type="button"
                  onClick={handleRetakeQuiz}
                  className="px-3 py-2 text-xs font-black uppercase tracking-wide rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  New 10 Questions
                </button>
              </div>
              <div
                className="prose prose-slate max-w-none"
                // Content is loaded from local bundled JSON files controlled in-repo.
                dangerouslySetInnerHTML={{ __html: selectedLevelData.miniLesson || '' }}
              />
            </section>

            <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
              <h2 className="text-xs uppercase tracking-[0.16em] font-black text-slate-500 mb-5">Quiz (10 Questions)</h2>
              {isQuizComplete ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
                  <h3 className="text-2xl font-black text-slate-900">Quiz Complete</h3>
                  <p className="text-slate-600 mt-2">Your score: <span className="font-black text-slate-900">{correctCount}/{totalQuestions}</span> ({scorePercent}%)</p>
                  <p className={`text-sm font-bold mt-3 ${hasPassedLevel ? 'text-green-700' : 'text-amber-700'}`}>
                    {hasPassedLevel
                      ? 'Great work! You unlocked the next level.'
                      : 'Score 80% or higher to unlock the next level.'}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleRetakeQuiz}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
                    >
                      Try Again
                    </button>

                    {hasPassedLevel && hasNextLevel && (
                      <button
                        type="button"
                        onClick={() => handleLevelChange(nextLevel)}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-900 bg-slate-900 text-white hover:bg-black"
                      >
                        Next Level
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { window.location.href = '/dashboard' }}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900"
                    >
                      Back to Dashboard
                    </button>
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
                      <article key={question.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                        <h3 className="font-bold text-slate-900 mb-4">{index + 1}. {question.question}</h3>

                        <fieldset className="space-y-2">
                          {question.options.map((option) => {
                            const inputId = `${question.id}-${option}`
                            return (
                              <label key={option} htmlFor={inputId} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50">
                                <input
                                  id={inputId}
                                  type="radio"
                                  name={question.id}
                                  value={option}
                                  checked={selectedAnswer === option}
                                  onChange={() => handleSelect(question.id, option)}
                                  className="h-4 w-4 accent-slate-900"
                                />
                                <span className="text-sm font-medium text-slate-700">{option}</span>
                              </label>
                            )
                          })}
                        </fieldset>

                        {hasSubmitted && isAnswered && (
                          <div className={`mt-4 rounded-xl border p-3 ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                            <p className={`text-sm font-black ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                              {isCorrect ? 'Correct' : `Incorrect (Correct answer: ${correctAnswer})`}
                            </p>
                            <p className="text-sm text-slate-700 mt-1">{question.explanation}</p>
                          </div>
                        )}
                      </article>
                    )
                  })}
                {!hasSubmitted && answeredCount === totalQuestions && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={handleSubmitQuiz}
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl transition-colors shadow-lg"
                    >
                      Submit Answers
                    </button>
                  </div>
                )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
