import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, AlertCircle, FileText, CheckCircle2, ChevronDown, Check, X, Shield, Clock } from 'lucide-react';

export default function StudentReview({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSubmissionIndex, setActiveSubmissionIndex] = useState(0);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://hayford-learning-hub.onrender.com/api/scores/student/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch student data');
        
        setStudentData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [id]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 font-medium">Loading student data...</div>;
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Failed to Load Profile</h2>
          <p className="text-slate-500 text-sm mb-6">{error || 'Unknown error occurred.'}</p>
          <button onClick={() => navigate('/dashboard')} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">Return to Roster</button>
        </div>
      </div>
    );
  }

  const activeSubmission = studentData.submissions && studentData.submissions.length > 0 
    ? studentData.submissions[activeSubmissionIndex] 
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors border border-slate-200"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-black text-slate-900 tracking-tight text-xl leading-none">
              {studentData.student.first_name} {studentData.student.last_name}
            </h1>
            <span className="text-xs font-bold text-slate-500">{studentData.student.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 flex items-center gap-2">
            <BookOpen size={14} /> Total Submissions: {studentData.submissions.length}
          </div>
        </div>
      </header>

      {studentData.submissions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center max-w-lg">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-slate-900 mb-2">No Submissions Yet</h2>
            <p className="text-slate-500 font-medium">This student hasn't completed any IELTS Writing modules yet. Once they practice on the launchpad, their attempts will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-h-[calc(100vh-73px)]">
          {/* Left Panel: The Work */}
          <div className="w-full lg:w-1/2 p-8 overflow-y-auto bg-slate-50 border-r border-slate-200 scrollbar-hide">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><FileText className="text-indigo-600" /> Student Draft</h2>
              
              {/* Submission Selector (if multiple) */}
              {studentData.submissions.length > 1 && (
                <select 
                  className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-2.5 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={activeSubmissionIndex}
                  onChange={(e) => setActiveSubmissionIndex(Number(e.target.value))}
                >
                  {studentData.submissions.map((sub, idx) => (
                    <option key={sub.id} value={idx}>
                      Attempt {studentData.submissions.length - idx}: {new Date(sub.completed_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-6">
               <div className="flex flex-col gap-1 mb-6 border-b border-slate-100 pb-6">
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-2"><BookOpen size={12}/> Academic IELTS task 1</div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{activeSubmission.module_name} — {activeSubmission.module_type}</h3>
                  <div className="text-sm font-bold text-slate-400 mt-2 flex items-center gap-4">
                     <span className="flex items-center gap-1.5"><Clock size={14}/> {new Date(activeSubmission.completed_at).toLocaleString()}</span>
                     <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">{activeSubmission.word_count} words</span>
                  </div>
               </div>
               
               <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                 {activeSubmission.submitted_text}
               </div>
            </div>
          </div>

          {/* Right Panel: The AI Examiner */}
          <div className="w-full lg:w-1/2 p-8 overflow-y-auto bg-slate-100 scrollbar-hide">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><Shield className="text-indigo-600" /> AI Examiner Breakdown</h2>
             </div>

             {/* Overall Score Card */}
             <div className="bg-gradient-to-br from-indigo-950 to-indigo-900 rounded-3xl p-8 text-white shadow-glow mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex-1 text-center md:text-left">
                      <div className="inline-block px-3 py-1 bg-indigo-800/50 rounded-full text-[10px] font-black tracking-widest text-indigo-300 border border-indigo-700 uppercase mb-4">Official Rating</div>
                      <h3 className="text-3xl font-black tracking-tight mb-2">Overall Band Score</h3>
                      {activeSubmission.ai_feedback?.modelHighlights && (
                        <p className="text-indigo-200 text-sm italic font-medium">"{activeSubmission.ai_feedback.modelHighlights}"</p>
                      )}
                   </div>
                   <div className="w-32 h-32 shrink-0 bg-white rounded-full flex flex-col items-center justify-center p-2 shadow-2xl border-4 border-indigo-500">
                      <span className="text-5xl font-black text-indigo-950 tracking-tighter">{activeSubmission.overall_score}</span>
                   </div>
                </div>
             </div>

             {/* Detailed Breakdown Cards */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
               
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                     <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Task Achievement</span>
                     <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.taskAchievement?.score || '-'}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.taskAchievement?.comments || 'No comments provided.'}</p>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                     <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Coherence & Cohesion</span>
                     <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.coherence?.score || '-'}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.coherence?.comments || 'No comments provided.'}</p>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                     <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Lexical Resource</span>
                     <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.lexicalResource?.score || '-'}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.lexicalResource?.comments || 'No comments provided.'}</p>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                     <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Grammar & Accuracy</span>
                     <span className="text-2xl font-black text-slate-900">{activeSubmission.ai_feedback?.rubricDetails?.grammaticalRange?.score || '-'}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">{activeSubmission.ai_feedback?.rubricDetails?.grammaticalRange?.comments || 'No comments provided.'}</p>
               </div>
             </div>

             {/* Actionable Advice List */}
             {activeSubmission.ai_feedback?.actionableAdvice && activeSubmission.ai_feedback.actionableAdvice.length > 0 && (
               <div className="bg-slate-900 p-8 rounded-3xl shadow-glow text-white">
                 <h3 className="font-black text-lg mb-6 flex items-center gap-2 tracking-tight"><CheckCircle2 className="text-green-400"/> Primary Improvement Areas</h3>
                 <ul className="space-y-4">
                   {activeSubmission.ai_feedback.actionableAdvice.map((advice, idx) => (
                     <li key={idx} className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                       <div className="w-6 h-6 shrink-0 bg-indigo-500 text-white rounded-full flex justify-center items-center text-xs font-black">{idx + 1}</div>
                       <p className="text-sm font-medium text-slate-200 pt-0.5 leading-relaxed">{advice}</p>
                     </li>
                   ))}
                 </ul>
               </div>
             )}

          </div>
        </div>
      )}
    </div>
  );
}
