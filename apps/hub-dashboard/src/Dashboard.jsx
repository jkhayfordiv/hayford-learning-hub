import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, User, Shield, Calendar, CheckCircle2, FileText, ChevronRight, PenTool, Settings, HelpCircle, ChevronDown, HelpCircle as HelpIcon, X, Moon, Sun, Users, RefreshCw, BarChart3, MessageSquare } from 'lucide-react';
import TeacherDashboard from './TeacherDashboard';
import WordBank from './components/WordBank';
import StudentFeedbackModal from './components/StudentFeedbackModal';
import logo from './assets/logo.png';

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

const DIAGNOSTIC_TO_TOPIC_MAP = {
  'Article Usage': '01_article_usage',
  'Countability & Plurals': '02_countability_and_plurals',
  'Pronoun Reference': '03_pronoun_reference',
  'Prepositional Accuracy': '04_prepositional_accuracy',
  'Word Forms': '05_word_forms',
  'Subject-Verb Agreement': '06_subject_verb_agreement',
  'Tense Consistency': '07_tense_consistency',
  'Present Perfect vs. Past Simple': '08_present_perfect_past_simple',
  'Gerunds vs. Infinitives': '09_gerunds_infinitives',
  'Passive Voice Construction': '10_passive_voice',
  'Sentence Boundaries': '11_sentence_boundaries',
  'Relative Clauses': '12_relative_clauses',
  'Subordination': '13_subordination',
  'Word Order': '14_word_order',
  'Parallel Structure': '15_parallel_structure',
  'Transitional Devices': '16_transitional_devices',
  'Collocations': '17_collocations',
  'Academic Register': '18_academic_register',
  'Nominalization': '19_nominalization',
  'Hedging': '20_hedging'
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

  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

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
  const [isLeaving, setIsLeaving] = useState(false);
  const [selectedFeedbackScore, setSelectedFeedbackScore] = useState(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  
  // PHASE 4.2: Student Limbo Modal (shows when class_id is null)
  const [showLimboModal, setShowLimboModal] = useState(false);
  const [limboModalDismissed, setLimboModalDismissed] = useState(
    localStorage.getItem('limboModalDismissed') === 'true'
  );

  // PHASE 4: User Weaknesses Tracking
  const [weaknesses, setWeaknesses] = useState([]);
  const [isLoadingWeaknesses, setIsLoadingWeaknesses] = useState(true);

  // Show more state for recent activities
  const [showAllRecentActivities, setShowAllRecentActivities] = useState(false);
  const [showAllCompletedWork, setShowAllCompletedWork] = useState(false);

  useEffect(() => {
    // Show limbo modal if student has no class and hasn't dismissed it this session
    if (user.role === 'student' && !user.class_id && !limboModalDismissed) {
      setShowLimboModal(true);
    }
  }, [user.class_id, user.role, limboModalDismissed]);

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
      const res = await fetch(`${apiBase}/api/classes/join`, {
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

  const fetchWeaknesses = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${apiBase}/api/users/${user.id}/weaknesses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setWeaknesses(data);
      }
    } catch (err) {
      console.error('Failed to fetch weaknesses', err);
    } finally {
      setIsLoadingWeaknesses(false);
    }
  };

  const fetchScores = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/login');

      const res = await fetch(`${apiBase}/api/scores/my-scores`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Auto-logout on token expiry
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('theme');
        localStorage.removeItem('limboModalDismissed');
        navigate('/login');
        return;
      }
      
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

  const handleMarkFeedbackAsRead = async (assignmentId) => {
    try {
      // Immediately update local state to hide the banner
      setScores(prevScores => 
        prevScores.map(score => 
          score.id === assignmentId 
            ? { ...score, teacher_comment_read: true }
            : score
        )
      );

      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/assignments/${assignmentId}/mark-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Auto-logout on token expiry
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('theme');
        localStorage.removeItem('limboModalDismissed');
        navigate('/login');
        return;
      }
      
      // Refresh scores to sync with server (in background)
      fetchScores();
    } catch (error) {
      console.error('Error marking feedback as read:', error);
      // Revert the optimistic update on error
      fetchScores();
    }
  };

  const handleLeaveClass = async () => {
    if (!confirm('Are you sure you want to leave this class? Your incomplete assignments from this class will be removed.')) return;
    setIsLeaving(true);
    try {
      const res = await fetch(`${apiBase}/api/classes/leave`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to leave class');
      
      const updatedUser = { ...user, class_id: null, class_name: null };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLeaving(false);
    }
  };

  useEffect(() => {
    // Clear any stale vocab practice data when returning to dashboard
    sessionStorage.removeItem('custom_practice_words');
    
    // Refresh user data from server on every mount to prevent stale data
    const refreshUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${apiBase}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Auto-logout on token expiry
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('theme');
          localStorage.removeItem('limboModalDismissed');
          navigate('/login');
          return;
        }
        
        if (res.ok) {
          const freshUser = await res.json();
          localStorage.setItem('user', JSON.stringify(freshUser));
        }
      } catch (err) {
        console.error('Failed to refresh user data', err);
      }
    };

    refreshUserData();
    fetchWeaknesses();
  }, [navigate, apiBase]);

  useEffect(() => {
    // Only fetch scores if it is a student dashboard
    if (user.role === 'teacher' || user.role === 'admin') {
       setIsLoading(false);
       return;
    }

    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${apiBase}/api/assignments/my-tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Auto-logout on token expiry
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('theme');
          localStorage.removeItem('limboModalDismissed');
          navigate('/login');
          return;
        }
        
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

  // Re-fetch scores and tasks when user returns to this tab (e.g. after submitting in IELTS tool)
  useEffect(() => {
    if (user.role === 'teacher' || user.role === 'admin') return;
    const refreshStudentData = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      fetch(`${apiBase}/api/scores/my-scores`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : [])
        .then(data => setScores(data))
        .catch(() => {});
      fetch(`${apiBase}/api/assignments/my-tasks`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : [])
        .then(data => setTasks(data))
        .catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshStudentData();
    };

    const onFocus = () => refreshStudentData();
    const onPageShow = () => refreshStudentData();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [user.role]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('theme');
    localStorage.removeItem('limboModalDismissed');
    window.location.href = '/login';
  };

  const handleLaunchPractice = (type = 'writing') => {
    const token = localStorage.getItem('token');
    const path = type === 'speaking' ? '/ielts-speaking/' : '/ielts-writing/';
    window.location.href = `${path}?token=${token}`;
  };

  const handleRefresh = () => {
    const token = localStorage.getItem('token');
    if (!token || user.role !== 'student') return;
    fetch(`${apiBase}/api/scores/my-scores`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => setScores(data))
      .catch(() => {});
    fetch(`${apiBase}/api/assignments/my-tasks`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => setTasks(data))
      .catch(() => {});
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

  if (user.role === 'teacher' || user.role === 'admin' || user.role === 'super_admin') {
    return <TeacherDashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A1930] font-sans">
      {/* Top Navbar */}
      <header className="bg-brand-sangria dark:bg-brand-sangria border-b border-[#4A1410] dark:border-[#4A1410] px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
           <img src={logo} alt="Hayford Logo" onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-bold text-white tracking-tight leading-none text-lg group-hover:text-white/80 transition-colors">
              Hayford Global Learning Hub
            </h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-white/70">
              Student Dashboard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 relative" ref={dropdownRef}>
          <button onClick={handleRefresh} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Refresh scores and tasks">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setIsTourOpen(true)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden md:block" title="Quick Tour">
            <HelpIcon size={18} />
          </button>
          <div className="h-6 w-px bg-white/20 hidden md:block"></div>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-full border border-white/20 cursor-pointer"
          >
             <User size={14} className="text-white/70" />
             <span className="text-xs font-bold text-white">{user.first_name || 'Guest'}</span>
             <ChevronDown size={14} className={`text-white/70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
           {isDropdownOpen && (
            <div className="absolute top-12 right-0 w-56 bg-white dark:bg-[#0F1C2E] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 z-50">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
               </div>
               <div className="p-2 space-y-1">
                 <button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <div className="flex items-center gap-3">
                     {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} 
                     Theme
                   </div>
                   <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{theme}</span>
                 </button>
                 <button onClick={() => navigate('/my-stats')} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <BarChart3 size={16} /> My Stats
                 </button>
                 <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <Settings size={16} /> My Account
                 </button>
                 <a href="mailto:your-email@gmail.com" className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left">
                   <HelpCircle size={16} /> Help & Support
                 </a>
               </div>
               <div className="p-2 border-t border-slate-100 dark:border-slate-700">
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
        {/* New Teacher Feedback Notification Banner */}
        {(() => {
          const unreadFeedback = scores.filter(s => s.teacher_comment && !s.teacher_comment_read);
          if (unreadFeedback.length > 0) {
            return (
              <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top-4 fade-in">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 dark:bg-amber-600 rounded-full flex items-center justify-center animate-pulse">
                      <MessageSquare size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-sm">
                        {unreadFeedback.length === 1 ? 'New Teacher Feedback!' : `${unreadFeedback.length} New Teacher Feedbacks!`}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Your teacher has reviewed your work
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFeedbackScore(unreadFeedback[0]);
                      setIsFeedbackModalOpen(true);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-md flex items-center gap-2 whitespace-nowrap"
                  >
                    <MessageSquare size={16} />
                    View Feedback
                  </button>
                </div>
                {unreadFeedback.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-bold">{unreadFeedback.length} assignments</span> have new feedback. Scroll down to see all.
                    </p>
                  </div>
                )}
              </div>
            );
          }
          return null;
        })()}

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
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Here's an overview of your recent learning progress and completed modules.
              </p>
              {user.class_name && (
                <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-700">
                  <Users size={14} /> Class: {user.class_name}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/my-stats')}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <BarChart3 size={18} /> My Stats
            </button>
            {!user.class_id ? (
              <button 
                onClick={() => setIsJoinModalOpen(true)}
                className="bg-brand-navy dark:bg-brand-copper text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-[#a6682f] transition-colors shadow-sm"
              >
                <Users size={18} /> Join a Class
              </button>
            ) : (
              <button 
                onClick={handleLeaveClass}
                disabled={isLeaving}
                className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users size={18} /> {isLeaving ? 'Leaving...' : 'Leave Class'}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-8 pb-4">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`font-bold pb-4 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-amber-600 text-amber-700 dark:text-amber-500' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            style={{ marginBottom: '-17px' }}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('progress')}
            className={`font-bold pb-4 border-b-2 transition-colors ${activeTab === 'progress' ? 'border-amber-600 text-amber-700 dark:text-amber-500' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            style={{ marginBottom: '-17px' }}
          >
            My Progress
          </button>
          <button 
            onClick={() => setActiveTab('wordbank')}
            className={`font-bold pb-4 border-b-2 transition-colors ${activeTab === 'wordbank' ? 'border-amber-600 text-amber-700 dark:text-amber-500' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            style={{ marginBottom: '-17px' }}
          >
            My Word Bank
          </button>
        </div>

        {activeTab === 'overview' ? (
          <>
        {/* Your To-Do List Section */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2"><CheckCircle2 className="text-amber-600" /> Your To-Do List</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoadingTasks ? (
              <div className="col-span-full border border-slate-200 dark:border-slate-700 rounded-2xl p-8 bg-white dark:bg-slate-800 text-center text-slate-400">Loading your tasks...</div>
            ) : tasks.filter(t => t.status === 'pending').length === 0 ? (
              <div className="col-span-full border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 bg-slate-50 dark:bg-slate-800/50 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><BookOpen size={32} className="text-slate-400" /></div>
                <div>
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">All caught up!</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">No homework assigned yet! Check back later or use the practice tools below.</p>
                </div>
              </div>
            ) : (
              tasks.filter(t => t.status === 'pending').map(task => (
                <div key={task.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col h-full">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-900 dark:bg-amber-600"></div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-amber-600 mb-1">
                          {task.assignment_type === 'writing' 
                            ? task.writing_task_type === '1' 
                              ? 'IELTS Task 1 Academic' 
                              : task.writing_task_type === '2' 
                                ? 'IELTS Task 2 Essay' 
                                : 'IELTS Task 1 & 2'
                            : task.assignment_type === 'speaking'
                              ? task.speaking_parts && task.speaking_parts.length > 1
                                ? `IELTS Speaking Parts ${task.speaking_parts.join(', ')}`
                                : `IELTS Speaking Part ${task.speaking_task_part || (task.speaking_parts && task.speaking_parts[0]) || '1'}`
                              : task.assignment_type === 'grammar-practice'
                                ? `Grammar Lab: ${task.grammar_topic_id?.replace(/-/g, ' ') || 'Practice'}`
                                : task.assignment_type === 'vocabulary'
                                  ? 'Vocabulary Builder'
                                  : task.module_name}
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-2" title={task.instructions}>{task.instructions || 'General Practice Task'}</h4>
                      </div>
                    </div>
                    {task.due_date && (
                      <div className="inline-flex bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100 dark:border-rose-800 items-center gap-1.5 mb-4">
                        <Calendar size={14} /> Due {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-1.5 font-medium mt-1">
                      <User size={14} className="text-slate-400" /> Assigned by {task.teacher_first_name} {task.teacher_last_name}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (task.assignment_type === 'grammar-practice') {
                        const grammarUrl = `/grammar-lab/?token=${localStorage.getItem('token')}&topicId=${encodeURIComponent(task.grammar_topic_id || '01_article_usage')}`;
                        window.location.href = grammarUrl;
                        return;
                      }
                      const instructionsObj = { 
                        assignment_id: task.id, 
                        instructions: task.instructions,
                        speaking_parts: task.speaking_parts 
                      };
                      if (task.assignment_type === 'vocabulary') {
                        window.location.href = `/vocab-tool/?token=${localStorage.getItem('token')}&taskMeta=${encodeURIComponent(JSON.stringify(instructionsObj))}`;
                      } else if (task.assignment_type === 'speaking') {
                        window.location.href = `/ielts-speaking/?token=${localStorage.getItem('token')}&taskMeta=${encodeURIComponent(JSON.stringify(instructionsObj))}`;
                      } else {
                        // IELTS Writing - pass writing_task_type (1, 2, or both)
                        const taskType = task.writing_task_type || '1';
                        const writingTaskParam = taskType === 'both' ? 'both' : `task${taskType}`;
                        window.location.href = `/ielts-writing/?token=${localStorage.getItem('token')}&taskMeta=${encodeURIComponent(JSON.stringify(instructionsObj))}&writingTask=${writingTaskParam}`;
                      }
                    }}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors mt-auto ${
                      task.assignment_type === 'vocabulary' 
                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600' 
                        : task.assignment_type === 'grammar-practice'
                          ? 'bg-brand-navy/10 dark:bg-brand-navy/30 text-brand-navy dark:text-blue-400 hover:bg-brand-navy hover:text-white dark:hover:bg-brand-navy'
                          : 'bg-slate-900 text-white hover:bg-slate-950 dark:bg-amber-600 dark:hover:bg-amber-700'
                    }`}
                  >
                    <PenTool size={18} /> {task.assignment_type === 'grammar-practice' ? 'Start Practice' : 'Start Assignment'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Targeted Weaknesses Card */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Targeted Weaknesses
          </h3>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-sm">
            {isLoadingWeaknesses ? (
              <div className="text-center text-slate-400 py-8">Loading weakness analysis...</div>
            ) : weaknesses.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Excellent Work!</h4>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto">No consistent weaknesses detected yet. Keep practicing to maintain your strong performance!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">Based on AI analysis of your submissions, here are areas that need attention:</p>
                {weaknesses.map((weakness, idx) => {
                  const maxCount = weaknesses[0]?.error_count || 1;
                  const percentage = (weakness.error_count / maxCount) * 100;
                  const getColorClasses = (count) => {
                    if (count >= maxCount * 0.7) return { bg: 'bg-red-500', lightBg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' };
                    if (count >= maxCount * 0.4) return { bg: 'bg-amber-500', lightBg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' };
                    return { bg: 'bg-brand-navy', lightBg: 'bg-brand-navy/10 dark:bg-brand-navy/30', text: 'text-brand-navy dark:text-blue-400', border: 'border-brand-navy/20 dark:border-brand-navy/50' };
                  };
                  const colors = getColorClasses(weakness.error_count);
                  
                  return (
                    <div key={idx} className={`p-4 rounded-2xl border-2 ${colors.border} ${colors.lightBg}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full ${colors.bg} text-white font-black text-sm flex items-center justify-center`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className={`font-bold text-sm ${colors.text}`}>{weakness.category}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {weakness.error_count} {weakness.error_count === 1 ? 'error' : 'errors'} detected
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const topicId = DIAGNOSTIC_TO_TOPIC_MAP[weakness.category];
                            if (topicId) {
                              window.location.href = `/grammar-lab/?token=${localStorage.getItem('token')}&topicId=${encodeURIComponent(topicId)}`;
                            }
                          }}
                          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${colors.bg} text-white hover:opacity-90`}
                        >
                          Practice
                        </button>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full ${colors.bg} rounded-full transition-all duration-700 ease-out`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Metrics Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2 lg:col-span-1">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Completed Submissions</span>
              <span className="font-black text-slate-900 dark:text-white tracking-tighter text-3xl">{scores.length}</span>
           </div>
           
           <button
              onClick={() => window.location.href = `/ielts-writing/?token=${localStorage.getItem('token')}&writingTask=both`}
              className="bg-gradient-to-br from-brand-sangria to-[#4A1410] hover:from-[#4A1410] hover:to-[#3A0F0C] p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between transition-all hover:scale-105 cursor-pointer group lg:col-span-1"
           >
              <div className="flex items-center justify-between mb-2">
                 <PenTool size={24} className="text-white/90 group-hover:text-white transition-colors" />
                 <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Practice</span>
              </div>
              <h3 className="text-lg font-black tracking-tight leading-tight">IELTS Writing</h3>
              <p className="text-[10px] text-white/80 mt-1">Get instant band scores</p>
           </button>

           <button
              onClick={() => window.location.href = `/ielts-speaking/?token=${localStorage.getItem('token')}`}
              className="bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between transition-all hover:scale-105 cursor-pointer group lg:col-span-1"
           >
              <div className="flex items-center justify-between mb-2">
                 <MessageSquare size={24} className="text-white/90 group-hover:text-white transition-colors" />
                 <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Practice</span>
              </div>
              <h3 className="text-lg font-black tracking-tight leading-tight">IELTS Speaking</h3>
              <p className="text-[10px] text-white/80 mt-1">AI examiner simulation</p>
           </button>

           <button
              onClick={() => window.location.href = `/grammar-lab/?token=${localStorage.getItem('token')}`}
              className="bg-gradient-to-br from-brand-navy to-slate-800 hover:from-slate-800 hover:to-slate-900 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between transition-all hover:scale-105 cursor-pointer group lg:col-span-1"
           >
              <div className="flex items-center justify-between mb-2">
                 <BookOpen size={24} className="text-white/90 group-hover:text-white transition-colors" />
                 <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Workshop</span>
              </div>
              <h3 className="text-lg font-black tracking-tight leading-tight">Grammar Lab</h3>
              <p className="text-[10px] text-white/80 mt-1">Targeted skill builder</p>
           </button>

           <button
              onClick={() => setActiveTab('wordbank')}
              className="bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between transition-all hover:scale-105 cursor-pointer group lg:col-span-1"
           >
              <div className="flex items-center justify-between mb-2">
                 <RefreshCw size={24} className="text-white/90 group-hover:text-white transition-colors" />
                 <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Word Bank</span>
              </div>
              <h3 className="text-lg font-black tracking-tight leading-tight">Vocab Builder</h3>
              <p className="text-[10px] text-white/80 mt-1">Academic Word Bank</p>
           </button>
        </div>

        {/* Scores Table */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight flex items-center gap-2"><FileText className="text-slate-400" /> Recent Learning Activity</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                  <th className="px-8 py-4">Submission Date</th>
                  <th className="px-8 py-4">Module / Task Type</th>
                  <th className="px-8 py-4">Word Count</th>
                  <th className="px-8 py-4 text-center">Score</th>
                  <th className="px-8 py-4"></th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-700">
                {isLoading ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-slate-400">Loading history...</td></tr>
                ) : scores.length === 0 ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-slate-400">No recent submissions found. Start practicing!</td></tr>
                ) : (
                  (showAllRecentActivities ? scores : scores.slice(0, 4)).map((score) => (
                    <tr 
                      key={score.id} 
                      onClick={() => {
                        setSelectedFeedbackScore(score);
                        setIsFeedbackModalOpen(true);
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-8 py-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><Calendar size={14} className="text-slate-400" /></div>
                        {new Date(score.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{score.module_name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{score.module_type}</div>
                          </div>
                          {score.teacher_comment && !score.teacher_comment_read && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-black rounded-md border border-amber-200 dark:border-amber-700 animate-pulse">
                              <MessageSquare size={12} /> New Feedback
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">{score.word_count} words</td>
                      <td className="px-8 py-6 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-black rounded-lg border border-green-200 dark:border-green-700">
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
          {!isLoading && scores.length > 4 && (
            <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => setShowAllRecentActivities(!showAllRecentActivities)}
                className="w-full py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {showAllRecentActivities ? 'Show Less' : `Show More (${scores.length - 4} more)`}
              </button>
            </div>
          )}
        </div>
        </>
        ) : activeTab === 'progress' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top 3 Focus Areas */}
            {topFocusAreas.length > 0 && (
              <div className="mb-12">
                <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2">
                  <Shield className="text-amber-600" /> DRA: Top 3 Focus Areas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topFocusAreas.map((area, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 font-black border border-rose-100 dark:border-rose-800">
                          #{idx + 1}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded">
                          {area.count} {area.count === 1 ? 'Error' : 'Errors'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{area.displayTag}</h4>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                        Review this area before your next submission to improve your band score.
                      </p>
                      {DIAGNOSTIC_TO_TOPIC_MAP[area.tag] && (
                        <button 
                          onClick={() => {
                            const topicId = DIAGNOSTIC_TO_TOPIC_MAP[area.tag];
                            window.location.href = `/grammar-lab?token=${localStorage.getItem('token')}&topicId=${topicId}`;
                          }}
                          className="mt-4 w-full bg-slate-900 dark:bg-amber-600 hover:bg-slate-950 dark:hover:bg-amber-700 text-white font-bold py-2 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
                        >
                          Practice Now ⚡
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2"><CheckCircle2 className="text-amber-600" /> My Completed Work</h3>
            <div className="space-y-4">
              {isLoading ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-8 bg-white dark:bg-slate-800 text-center text-slate-400">Loading history...</div>
              ) : scores.length === 0 ? (
                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 bg-slate-50 dark:bg-slate-800/50 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><CheckCircle2 size={32} className="text-slate-400" /></div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">No submissions yet</h4>
                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">Complete an assignment or practice task to see your progress here.</p>
                  </div>
                </div>
              ) : (
                (showAllCompletedWork ? scores : scores.slice(0, 4)).map((score) => (
                  <div key={score.id} className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-sm ${
                    score.teacher_comment && !score.teacher_comment_read 
                      ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-200 dark:ring-amber-900/50' 
                      : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    <div 
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      onClick={() => {
                        if (score.teacher_comment) {
                          setSelectedFeedbackScore(score);
                          setIsFeedbackModalOpen(true);
                        } else {
                          setExpandedScoreId(expandedScoreId === score.id ? null : score.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl flex flex-col items-center justify-center border border-amber-100 dark:border-amber-700">
                          <span className="text-sm font-black">{Number(score.overall_score).toFixed(1)}</span>
                          <span className="text-[8px] uppercase font-bold tracking-widest">Score</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white">{score.module_name}</h4>
                            {score.teacher_comment && !score.teacher_comment_read && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-300 dark:border-amber-700 animate-pulse">
                                <MessageSquare size={10} /> New Feedback
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">{score.module_type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Calendar size={14} />
                          {new Date(score.completed_at).toLocaleDateString()}
                        </div>
                        {score.teacher_comment ? (
                          <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                        ) : (
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedScoreId === score.id ? 'rotate-180 text-amber-600' : ''}`} />
                        )}
                      </div>
                    </div>
                    
                    {expandedScoreId === score.id && (
                      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-sm animate-in slide-in-from-top-2">
                        <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs mb-3">AI Feedback</h5>
                        {score.ai_feedback ? (
                          <div className="space-y-4">
                            {score.module_type === 'vocabulary' && Array.isArray(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback) ? (
                              (typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback).map((f, i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div className="font-bold text-indigo-900 dark:text-indigo-400 mb-1">{f?.word || 'Unknown Word'}</div>
                                  <div className="text-slate-600 dark:text-slate-300 italic mb-2">"{f?.sentence || 'No sentence provided'}"</div>
                                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    💡 {f?.feedback?.explanation || "No explanation"}
                                  </div>
                                </div>
                              ))
                            ) : (typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.bandScore ? (
                              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <p className="text-slate-700 dark:text-slate-300 italic border-l-4 border-indigo-200 dark:border-indigo-700 pl-4 mb-4">"{(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.modelHighlights}"</p>
                                <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                                  <div><span className="font-bold text-slate-900 dark:text-white">Task Achievement:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.taskAchievement}</div>
                                  <div><span className="font-bold text-slate-900 dark:text-white">Coherence:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.coherenceCohesion}</div>
                                  <div><span className="font-bold text-slate-900 dark:text-white">Lexical:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.lexicalResource}</div>
                                  <div><span className="font-bold text-slate-900 dark:text-white">Grammar:</span> {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.grammarAccuracy}</div>
                                </div>
                                <div className="mt-4">
                                  <span className="font-bold text-slate-900 dark:text-white text-xs">Improvement Tips:</span>
                                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600 dark:text-slate-300">
                                    {(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback)?.improvementTips?.map((tip, i) => <li key={i}>{tip}</li>)}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-600 dark:text-slate-300 overflow-x-auto">
                                {JSON.stringify(typeof score.ai_feedback === 'string' ? JSON.parse(score.ai_feedback) : score.ai_feedback, null, 2)}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-500 text-sm">No detailed feedback available for this submission.</div>
                        )}
                        <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs mt-6 mb-3">Your Answer</h5>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-serif leading-relaxed italic">
                          "{score.submitted_text}"
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {!isLoading && scores.length > 4 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowAllCompletedWork(!showAllCompletedWork)}
                    className="w-full py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {showAllCompletedWork ? 'Show Less' : `Show More (${scores.length - 4} more)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'wordbank' ? (
          <WordBank user={user} />
        ) : null}

      </main>

      {/* Quick Tour Modal overlay */}
      {isTourOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-900 dark:bg-slate-900">
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

      {/* PHASE 4.2: Student Limbo Modal - Appears when student has no class */}
      {showLimboModal && user.role === 'student' && !user.class_id && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-darkBg border dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-brand-copper to-amber-600">
              <h3 className="font-black text-2xl text-white tracking-tight flex items-center gap-2">
                <Users className="text-white" size={28} /> Connect with Your Teacher
              </h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-amber-100">
                <BookOpen size={40} />
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">
                Enter Your Class Code
              </h4>
              <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                To access assignments and connect with your teacher, enter the 6-character class code provided by your instructor.
              </p>
              
              {joinError && (
                <div className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{joinError}</div>
              )}
              
              <input 
                autoFocus
                type="text" 
                value={joinCode} 
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="A1B2C3" 
                maxLength={6}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-copper transition-all font-black text-center tracking-[0.3em] text-2xl placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal uppercase"
              />
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setShowLimboModal(false);
                    setLimboModalDismissed(true);
                    localStorage.setItem('limboModalDismissed', 'true');
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Practice Solo
                </button>
                <button 
                  disabled={isJoining || joinCode.length < 6}
                  onClick={handleJoinClass} 
                  className="flex-1 bg-brand-copper text-white font-black py-3 rounded-xl hover:bg-[#a6682f] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isJoining ? 'Joining...' : 'Join Class'}
                </button>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-600 pt-2">
                Don't have a code? You can still practice independently!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Student Feedback Modal */}
      {isFeedbackModalOpen && selectedFeedbackScore && (
        <StudentFeedbackModal
          score={selectedFeedbackScore}
          onClose={() => {
            setIsFeedbackModalOpen(false);
            setSelectedFeedbackScore(null);
          }}
          onMarkAsRead={handleMarkFeedbackAsRead}
        />
      )}
    </div>
  );
}
