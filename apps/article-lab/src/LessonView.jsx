import React from 'react';
import { BookOpen, ArrowRight, Lightbulb, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function LessonView({ onStartPractice }) {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-200">
          <BookOpen size={32} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
          The Article Lab
        </h1>
        <p className="text-lg font-medium text-slate-500 max-w-2xl mx-auto">
          Articles can be tricky! Read these simple rules, then try the practice to test your knowledge.
        </p>
      </div>

      <div className="space-y-8 mb-12">
        {/* Rule 1: A / An */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <h2 className="text-2xl font-black text-slate-900 mb-4 flex items-center gap-2">
            1. Indefinite Articles: A / An
          </h2>
          <p className="text-slate-600 font-medium mb-4">
            Use <strong>A</strong> or <strong>An</strong> for one single thing when you talk about it for the very first time. It means "any one" of that thing.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50/50 border border-green-200 rounded-2xl p-4">
              <span className="text-xs font-black uppercase text-green-700 tracking-widest flex items-center gap-1.5 mb-2"><CheckCircle2 size={14}/> Correct</span>
              <p className="text-slate-700">"I read <strong>a</strong> new book yesterday."</p>
            </div>
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-4">
               <span className="text-xs font-black uppercase text-red-700 tracking-widest flex items-center gap-1.5 mb-2"><AlertOctagon size={14}/> 🚫 Incorrect</span>
               <p className="text-slate-700">"I read <strong>the</strong> new book yesterday." <br/><span className="text-xs text-red-500 font-medium">(We don't know which book yet)</span></p>
            </div>
          </div>
          <div className="mt-4 bg-indigo-50 text-indigo-800 p-4 rounded-xl text-sm font-medium flex items-start gap-3">
             <Lightbulb className="shrink-0 text-indigo-500" size={18} />
             <p>💡 <strong>Tip:</strong> Use "A" before a consonant sound, and "An" before a vowel sound (e.g., <strong>an</strong> apple, <strong>a</strong> car).</p>
          </div>
        </div>

        {/* Rule 2: The */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <h2 className="text-2xl font-black text-slate-900 mb-4 flex items-center gap-2">
            2. Definite Article: The
          </h2>
          <p className="text-slate-600 font-medium mb-4">
            Use <strong>The</strong> when the listener knows exactly which thing you mean. You use it when you talk about something for the second time, or if there is only one in the world (like the sun).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50/50 border border-green-200 rounded-2xl p-4">
              <span className="text-xs font-black uppercase text-green-700 tracking-widest flex items-center gap-1.5 mb-2"><CheckCircle2 size={14}/> Correct</span>
              <p className="text-slate-700">"I read a book. <strong>The</strong> book was great."</p>
            </div>
            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 text-sm font-medium text-amber-900">
               <Lightbulb className="shrink-0 text-amber-500 inline mr-2" size={16} />
               💡 Also use "The" for the best of something (<strong>the</strong> biggest), oceans/rivers (<strong>the</strong> Nile), and the earth/environment.
            </div>
          </div>
        </div>

        {/* Rule 3: Zero Article */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <h2 className="text-2xl font-black text-slate-900 mb-4 flex items-center gap-2">
            3. Zero Article (None)
          </h2>
          <p className="text-slate-600 font-medium mb-4">
            Do not use an article (None) when you talk about things in a general way. We usually use no article for plural words (like 'students') or things you cannot count (like 'water' or 'information').
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50/50 border border-green-200 rounded-2xl p-4">
              <span className="text-xs font-black uppercase text-green-700 tracking-widest flex items-center gap-1.5 mb-2"><CheckCircle2 size={14}/> Correct</span>
              <p className="text-slate-700">"<strong>Water</strong> is important for all life."</p>
            </div>
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-4">
               <span className="text-xs font-black uppercase text-red-700 tracking-widest flex items-center gap-1.5 mb-2"><AlertOctagon size={14}/> 🚫 Incorrect</span>
               <p className="text-slate-700">"<strong>The water</strong> is important for all life." <br/><span className="text-xs text-red-500 font-medium">(This means specific water, not all water)</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button 
          onClick={onStartPractice}
          className="bg-slate-900 hover:bg-slate-950 text-white font-black text-lg py-4 px-10 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform active:scale-95 flex items-center gap-3"
        >
          Start Practice <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
