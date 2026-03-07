import React, { useState } from 'react';
import { LayoutDashboard, BookOpen } from 'lucide-react';
import LessonView from './LessonView';
import PracticeView from './PracticeView';

export default function App() {
  const [view, setView] = useState('lesson');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl">
             <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-none text-lg">The Article Lab</h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Targeted Practice Module</span>
          </div>
        </div>
        <button 
           onClick={() => window.location.href = 'http://localhost:5173'}
           className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-2 active:scale-95"
        >
          <LayoutDashboard size={16} /> Return to Hub
        </button>
      </header>

      <main className="flex-1 overflow-y-auto w-full">
        {view === 'lesson' ? (
          <LessonView onStartPractice={() => setView('practice')} />
        ) : (
          <PracticeView onReturnHome={() => setView('lesson')} />
        )}
      </main>
    </div>
  );
}
