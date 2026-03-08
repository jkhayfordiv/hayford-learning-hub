import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, User, Shield, Calendar, CheckCircle2, FileText, ChevronRight, PenTool, Settings, HelpCircle, ChevronDown, HelpCircle as HelpIcon, X, Moon, Sun, Users } from 'lucide-react';
import TeacherDashboard from './TeacherDashboard';

const DIAGNOSTIC_DICTIONARY = {
  // Nouns & Mechanics
  'Article Usage': 'Using "A", "An", and "The" Correctly',
  'Countability & Plurals': 'Singular vs. Plural Words',
  'Pronoun Reference': 'Using "He", "She", "It", "They" Clearly',
  'Prepositional Accuracy': 'Small Words (In, On, At, To)',
  'Word Forms': 'Word Types (Noun vs. Verb vs. Adjective)',
  
  // Verbs & Time
  'Subject-Verb Agreement': 'Matching Subjects and Verbs',
  'Tense Consistency': 'Keeping Time Words the Same',
  'Present Perfect vs. Past Simple': 'Talking About the Past Correctly',
  'Gerunds vs. Infinitives': 'Using "-ing" vs "to [verb]"',
  'Passive Voice Construction': 'Using the Passive Voice',
  
  // Sentence Architecture
  'Sentence Boundaries': 'Complete Sentences (Fixing Run-ons)',
  'Relative Clauses': 'Adding Detail with "Who", "Which", "That"',
  'Subordination': 'Connecting Ideas (Because, Although, If)',
  'Word Order': 'Putting Words in the Right Order',
  'Parallel Structure': 'Keeping Lists Balanced',
  
  // Academic Discourse
  'Transitional Devices': 'Linking Sentences Smoothly',
  'Collocations': 'Words That Naturally Go Together',
  'Academic Register': 'Formal Tone (Avoiding Slang)',
  'Nominalization': 'Using Academic Nouns',
  'Hedging': 'Softening Claims (Might, Could, Often)'
};

export default function Dashboard() {
  const navigate = useNavigate();
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  const [scores, setScores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedScoreId, setExpandedScoreId] = useState(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const dropdownRef = useRef(null);

  // New Features: Dark Mode & Join Class
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => {
     const newTheme = theme === 'light' ? 'dark' : 'light';
     setTheme(newTheme);
     localStorage.setItem('theme', newTheme);
  };

  const handleJoinClass = async () => {
    setIsJoining(true);
    setJoinError('');
    try {
      const res = await fetch('https://hayford-learning-hub.onrender.com/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ class_code: joinCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join class');
      
      const updatedUser = { ...user, class_id: data.class_id };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setIsJoinModalOpen(false);
      window.location.reload();
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    // Only fetch scores if it is a student dashboard
    if (user.role === 'teacher' || user.role === 'admin') {
       setIsLoading(false);
       return;
    }

    const fetchScores = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/login');

        const res = await fetch('https://hayford-learning-hub.onrender.com/api/scores/my-scores', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setScores(data);
        }
      } catch (err) {
        console.error('Failed to fetch scores', err);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('https://hayford-learning-hub.onrender.com/api/assignments/my-tasks', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setTasks(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch tasks', err);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    fetchScores();
    fetchTasks();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleLaunchPractice = () => {
    // Pass JWT to the IELTS Writing App
    const token = localStorage.getItem('token');
    window.location.href = `/ielts-writing?token=${token}`;
  };

  // Helper to calculate top 3 frequent errors for the student
  const getTopFocusAreas = () => {
    const tagCounts = {};
    scores.forEach(score => {
      if (score.diagnostic_data) {
        try {
          const tags = typeof score.diagnostic_data === 'string' ? JSON.parse(score.diagnostic_data) : score.diagnostic_data;
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]) // Sort descending
      .slice(0, 3) // Top 3
      .map(([tag, count]) => ({ tag, count }));
  };

  const topFocusAreas = getTopFocusAreas().map(area => ({
    ...area,
    displayTag: DIAGNOSTIC_DICTIONARY[area.tag] || area.tag
  }));

  if (user.role === 'teacher' || user.role === 'admin') {
    return <TeacherDashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/dashboard')}>
           <img src="/logo.png" alt="Hayford Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-none text-lg group-hover:text-slate-700 transition-colors">
              Hayford Global Learning Hub
            </h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
              Student Dashboard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 relative" ref={dropdownRef}>
          <button onClick={() => setIsTourOpen(true)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors hidden md:block" title="Quick Tour">
            <HelpIcon size={18} />
          </button>
          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full border border-slate-200 cursor-pointer"
          >
             <User size={14} className="text-slate-500" />
             <span className="text-xs font-bold text-slate-700">{user.first_name || 'Guest'}</span>
             <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
           {isDropdownOpen && (
            <div className="absolute top-12 right-0 w-56 bg-white dark:bg-brand-darkBg border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 z-50">
               <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
               </div>
               <div className="p-2 space-y-1">
                 <button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <div className="flex items-center gap-3">
                     {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} 
                     Theme
                   </div>
                   <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{theme}</span>
                 </button>
                 {!user.class_id && (
                   <button onClick={() => { setIsDropdownOpen(false); setIsJoinModalOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-brand-copper hover:bg-amber-50 dark:hover:bg-brand-navy rounded-xl transition-colors text-left">
                     <Users size={16} /> Join a Class
                   </button>
                 )}
                 <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <Settings size={16} /> My Account
                 </button>
                 <a href="mailto:your-email@gmail.com" className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <HelpCircle size={16} /> Help & Support
                 </a>
               </div>
               <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                 <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-left">
                   <LogOut size={16} /> Logout
                 </button>
               </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            {scores.length === 0 ? (
               <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                 Welcome to Hayford Global, {user.first_name || 'Student'}! 👋
               </h2>
            ) : (
               <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                 Welcome back, {user.first_name || 'Student'}! 👋
               </h2>
            )}
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Here's an overview of your recent learning progress and completed modules.
            </p>
          </div>
          {!user.class_id && (
            <button 
              onClick={() => setIsJoinModalOpen(true)}
              className="bg-brand-navy dark:bg-brand-copper text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-[#a6682f] transition-colors shadow-sm"
            >
              <Users size={18} /> Join a Class
            </button>
          )}
        </div>

        <div className="flex gap-4 border-b border-slate-200 mb-8 pb-4">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`font-bold pb-4 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            style={{ marginBottom: '-17px' }}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('progress')}
            className={`font-bold pb-4 border-b-2 transition-colors ${activeTab === 'progress' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            style={{ marginBottom: '-17px' }}
          >
            My Progress
          </button>
        </div>

        {activeTab === 'overview' ? (
          <>
        {/* Your To-Do List Section */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="font-black text-xl text-slate-900 tracking-tight mb-4 flex items-center gap-2"><CheckCircle2 className="text-amber-600" /> Your To-Do List</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoadingTasks ? (
              <div className="col-span-full border border-slate-200 rounded-2xl p-8 bg-white text-center text-slate-400">Loading your tasks...</div>
            ) : tasks.filter(t => t.status === 'pending').length === 0 ? (
              <div className="col-span-full border border-dashed border-slate-300 rounded-3xl p-10 bg-slate-50 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center"><BookOpen size={32} className="text-slate-400" /></div>
                <div>
                  <h4 className="font-bold text-lg text-slate-900">All caught up!</h4>
                  <p className="text-slate-500 font-medium max-w-sm mx-auto">No homework assigned yet! Check back later or use the practice tools below.</p>
                </div>
              </div>
            ) : (
              tasks.filter(t => t.status === 'pending').map(task => (
                <div key={task.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col h-full">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-900"></div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">{task.module_name}</div>
                        <h4 className="font-bold text-slate-900 leading-tight line-clamp-2" title={task.instructions}>{task.instructions || 'General Practice Task'}</h4>
                      </div>
                    </div>
                    {task.due_date && (
                      <div className="inline-flex bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100 items-center gap-1.5 mb-4">
                        <Calendar size={14} /> Due {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mb-6 flex items-center gap-1.5 font-medium mt-1">
                      <User size={14} className="text-slate-400" /> Assigned by {task.teacher_first_name} {task.teacher_last_name}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const instructionsObj = { assignment_id: task.id, instructions: task.instructions };
                      const appPath = task.assignment_type === 'vocabulary' ? '/vocab-tool' : '/ielts-writing';
                      window.location.href = `${appPath}?token=${localStorage.getItem('token')}&taskMeta=${encodeURIComponent(JSON.stringify(instructionsObj))}`;
                    }}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors mt-auto ${
                      task.assignment_type === 'vocabulary' 
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white' 
                        : 'bg-slate-900 text-white hover:bg-slate-950'
                    }`}
                  >
                    <PenTool size={18} /> Start Assignment
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Interactive Learning Tools Section */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
           <h3 className="font-black text-xl text-slate-900 tracking-tight mb-4 flex items-center gap-2">Interactive Learning Tools</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                 onClick={() => window.location.href = `/ielts-writing?token=${localStorage.getItem('token')}`}
                 className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-400 transition-all cursor-pointer group flex items-start gap-6"
              >
                 <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-slate-900 transition-colors border border-amber-100 group-hover:border-slate-900">
                    <PenTool className="text-amber-700 group-hover:text-amber-500 w-8 h-8 transition-colors" />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">IELTS Writing Master</h4>
                    <p className="text-slate-500 font-medium">Practice Academic Task 1 with real-time AI feedback and band score estimations.</p>
                 </div>
              </div>
              
              <div 
                 onClick={() => window.location.href = `/vocab-tool?token=${localStorage.getItem('token')}`}
                 className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer group flex items-start gap-6"
              >
                 <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-600 transition-colors border border-amber-100 group-hover:border-amber-600">
                    <BookOpen className="text-amber-700 group-hover:text-white w-8 h-8 transition-colors" />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Vocabulary Builder</h4>
                    <p className="text-slate-500 font-medium">Sharpen your vocabulary skills by writing context-aware sentences graded by AI.</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Metrics Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Completed Submissions</span>
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{scores.length}</span>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Average Band Score</span>
              <span className="text-4xl font-black text-amber-600 tracking-tighter">
                {scores.length > 0 ? (scores.reduce((acc, curr) => acc + parseFloat(curr.overall_score), 0) / scores.length).toFixed(1) : 'N/A'}
              </span>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Global Ranking</span>
              <span className="text-4xl font-black text-slate-900 tracking-tighter">Top 15%</span>
           </div>
           <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl shadow-soft text-white flex flex-col justify-between border-t-2 border-amber-500">
              <div>
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest drop-shadow-sm">Account Logic</span>
                 <h3 className="text-xl font-bold mt-1 tracking-tight flex items-center gap-2 text-amber-50"><Shield size={18} className="text-amber-500" /> {user.role?.toUpperCase() || 'STUDENT'}</h3>
              </div>
           </div>
        </div>

        {/* Scores Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2"><FileText className="text-slate-400" /> Recent Learning Activity</h3>
            <button className="text-xs font-bold text-slate-900 bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">View Detailed Reports</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                  <th className="px-8 py-4">Submission Date</th>
                  <th className="px-8 py-4">Module / Task Type</th>
                  <th className="px-8 py-4">Word Count</th>
                  <th className="px-8 py-4 text-center">Score</th>
                  <th className="px-8 py-4"></th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-slate-400">Loading history...</td></tr>
                ) : scores.length === 0 ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-slate-400">No recent submissions found. Start practicing!</td></tr>
                ) : (
                  scores.map((score) => (
                    <tr key={score.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                      <td className="px-8 py-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Calendar size={14} className="text-slate-400" /></div>
                        {new Date(score.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900">{score.module_name}</div>
                        <div className="text-xs text-slate-500 mt-1">{score.module_type}</div>
                      </td>
                      <td className="px-8 py-6">{score.word_count} words</td>
                      <td className="px-8 py-6 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 font-black rounded-lg border border-green-200">
                          <CheckCircle2 size={14} /> {Number(score.overall_score).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <ChevronRight className={`w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-transform inline-block ${expandedScoreId === score.id ? 'rotate-90 text-indigo-500' : ''}`} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top 3 Focus Areas */}
            {topFocusAreas.length > 0 && (
              <div className="mb-12">
                <h3 className="font-black text-xl text-slate-900 tracking-tight mb-4 flex items-center gap-2">
                  <Shield className="text-amber-600" /> DRA: Top 3 Focus Areas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topFocusAreas.map((area, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-black border border-rose-100">
                          #{idx + 1}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded">
                          {area.count} {area.count === 1 ? 'Error' : 'Errors'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg leading-tight">{area.displayTag}</h4>
                      <p className="text-xs font-medium text-slate-500 mt-2">
                        Review this area before your next submission to improve your band score.
                      </p>
                      {area.tag === 'Article Usage' && (
                        <button 
                          onClick={() => window.location.href = `/article-lab?token=${localStorage.getItem('token')}`}
                          className="mt-4 w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
                        >
                          Practice Now ⚡
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="font-black text-xl text-slate-900 tracking-tight mb-4 flex items-center gap-2"><CheckCircle2 className="text-amber-600" /> My Completed Work</h3>
            <div className="space-y-4">
              {isLoading ? (
                <div className="border border-slate-200 rounded-2xl p-8 bg-white text-center text-slate-400">Loading history...</div>
              ) : scores.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-3xl p-10 bg-slate-50 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center"><CheckCircle2 size={32} className="text-slate-400" /></div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-900">No submissions yet</h4>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto">Complete an assignment or practice task to see your progress here.</p>
                  </div>
                </div>
              ) : (
                scores.map((score) => (
                  <div key={score.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div 
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedScoreId(expandedScoreId === score.id ? null : score.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex flex-col items-center justify-center border border-amber-100">
                          <span className="text-sm font-black">{Number(score.overall_score).toFixed(1)}</span>
                          <span className="text-[8px] uppercase font-bold tracking-widest">Score</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{score.module_name}</h4>
                          <span className="text-xs text-slate-500 uppercase tracking-widest">{score.module_type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                          <Calendar size={14} />
                          {new Date(score.completed_at).toLocaleDateString()}
                        </div>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedScoreId === score.id ? 'rotate-180 text-amber-600' : ''}`} />
                      </div>
                    </div>
                    
                    {expandedScoreId === score.id && (
                      <div className="p-6 bg-slate-50 border-t border-slate-100 text-sm animate-in slide-in-from-top-2">
                        <h5 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-3">AI Feedback</h5>
                        {score.ai_feedback ? (
                          <div className="space-y-4">
                            {score.module_type === 'vocabulary' && Array.isArray(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback) ? (
                              (typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback).map((f, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200">
                                  <div className="font-bold text-indigo-900 mb-1">{f?.word || 'Unknown Word'}</div>
                                  <div className="text-slate-600 italic mb-2">"{f?.sentence || 'No sentence provided'}"</div>
                                  <div className="text-slate-500 text-xs mt-2 pt-2 border-t border-slate-100">
                                    💡 {f?.feedback?.explanation || "No explanation"}
                                  </div>
                                </div>
                              ))
                            ) : (typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.bandScore ? (
                              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                                <p className="text-slate-700 italic border-l-4 border-indigo-200 pl-4 mb-4">"{(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.modelHighlights}"</p>
                                <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                                  <div><span className="font-bold text-slate-900">Task Achievement:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.taskAchievement}</div>
                                  <div><span className="font-bold text-slate-900">Coherence:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.coherenceCohesion}</div>
                                  <div><span className="font-bold text-slate-900">Lexical:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.lexicalResource}</div>
                                  <div><span className="font-bold text-slate-900">Grammar:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.grammarAccuracy}</div>
                                </div>
                                <div className="mt-4">
                                  <span className="font-bold text-slate-900 text-xs">Improvement Tips:</span>
                                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                                    {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.improvementTips?.map((tip, i) => <li key={i}>{tip}</li>)}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap bg-white p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-600 overflow-x-auto">
                                {JSON.stringify(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback, null, 2)}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-500 text-sm">No detailed feedback available for this submission.</div>
                        )}
                        <h5 className="font-black text-slate-900 uppercase tracking-widest text-xs mt-6 mb-3">Your Answer</h5>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-600 whitespace-pre-wrap font-serif leading-relaxed italic">
                          "{score.submitted_text}"
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* Quick Tour Modal overlay */}
      {isTourOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-900">
              <h3 className="font-black text-xl text-white tracking-tight flex items-center gap-2">
                <Shield className="text-amber-500" /> Quick Tour
              </h3>
              <button onClick={() => setIsTourOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 text-center space-y-4">
               <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-amber-100">
                  <CheckCircle2 size={32} />
               </div>
               <p className="text-slate-600 font-medium leading-relaxed">
                 New here? Check your <strong className="text-slate-900">To-Do list</strong> for assignments, or use the Interactive Learning Tools below to practice any time.
               </p>
               <button onClick={() => setIsTourOpen(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors mt-4 shadow-sm border border-slate-800">
                 Got it, thanks!
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Join Class Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-darkBg border dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Users className="text-brand-copper" /> Join Class
              </h3>
              <button onClick={() => setIsJoinModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
               <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed mb-6">
                 Ask your instructor for the 6-character class code and enter it below to join their roster.
               </p>
               {joinError && (
                 <div className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl mb-4 text-center">{joinError}</div>
               )}
               <input 
                 autoFocus
                 type="text" 
                 value={joinCode} 
                 onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                 placeholder="e.g. A1B2C3" 
                 maxLength={6}
                 className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-copper transition-all font-black text-center tracking-[0.2em] text-xl placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal mb-4 uppercase"
               />
               <button 
                 disabled={isJoining || joinCode.length < 3}
                 onClick={handleJoinClass} 
                 className="w-full bg-brand-navy dark:bg-brand-copper text-white font-black py-4 rounded-xl hover:bg-slate-800 dark:hover:bg-[#a6682f] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               >
                 {isJoining ? 'Verifying...' : 'Join Roster'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
