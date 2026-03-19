import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">
              IELTS Speaking Practice
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              AI-Powered Speaking Assessment & Feedback
            </p>
          </div>

          {/* Coming Soon Card */}
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-200">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-indigo-100 rounded-full mb-6">
              <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Coming Soon</h2>
            <p className="text-slate-600 text-lg mb-8 max-w-2xl mx-auto">
              The IELTS Speaking module is currently under development. This feature will include:
            </p>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="font-bold text-slate-900 mb-2">Part 1, 2 & 3</h3>
                <p className="text-sm text-slate-600">Complete IELTS Speaking test simulation</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="text-2xl mb-2">🤖</div>
                <h3 className="font-bold text-slate-900 mb-2">AI Feedback</h3>
                <p className="text-sm text-slate-600">Instant pronunciation and fluency analysis</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-bold text-slate-900 mb-2">Band Scoring</h3>
                <p className="text-sm text-slate-600">Detailed band score breakdown</p>
              </div>
            </div>
          </div>

          {/* Back to Dashboard */}
          <div className="text-center mt-8">
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
    </div>
  )
}

export default App
