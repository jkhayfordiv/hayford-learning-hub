import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Users, AlertCircle, PlusCircle, Calendar, X, Loader2, FileText, CheckCircle2, ChevronDown, User, Settings, HelpCircle, Trash2, Edit3 } from 'lucide-react';

export default function TeacherDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [activeClassId, setActiveClassId] = useState('all');
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', password: '', class_id: '' });
  const [classFormData, setClassFormData] = useState({ class_name: '' });
  const [registerStatus, setRegisterStatus] = useState({ loading: false, error: null, success: false });
  const [classStatus, setClassStatus] = useState({ loading: false, error: null, success: false });

  const [activeTab, setActiveTab] = useState('overview');
  const [assignments, setAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({ module_id: 1, student_id: 'all', class_id: '', assignment_type: 'writing', instructions: '', due_date: '' });
  const [assignmentStatus, setAssignmentStatus] = useState({ loading: false, error: null, success: false });
  const [expandedAssignmentId, setExpandedAssignmentId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editGroupData, setEditGroupData] = useState(null);
  const [editStatus, setEditStatus] = useState({ loading: false, error: null, success: false });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchClassData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/scores/class-overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Failed to fetch class overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setClasses(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch classes', err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/scores/recent', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRecentActivity(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch recent activity', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/assignments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAssignments(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch assignments', err);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchClassData();
    fetchAssignments();
    fetchRecentActivity();
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setAssignmentStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const payload = { ...assignmentForm };
      
      // Clear out the mutually exclusive fields before sending to API 
      if (payload.student_id && payload.student_id !== 'all' && !payload.student_id.startsWith('class_')) {
        payload.class_id = null;
      } else if (payload.student_id && payload.student_id.startsWith('class_')) {
        payload.class_id = payload.student_id.split('_')[1];
        payload.student_id = null;
      } else if (payload.student_id === 'all') {
        payload.class_id = null;
        payload.student_id = 'all';
      }

      const res = await fetch('http://localhost:3001/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create assignment');
      setAssignmentStatus({ loading: false, error: null, success: true });
      setAssignmentForm({ module_id: 1, student_id: 'all', class_id: '', assignment_type: 'writing', instructions: '', due_date: '' });
      fetchAssignments();
      setTimeout(() => setAssignmentStatus(prev => ({...prev, success: false})), 3000);
    } catch (err) {
      setAssignmentStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setClassStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(classFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create class');
      
      setClassStatus({ loading: false, error: null, success: true });
      setClassFormData({ class_name: '' });
      fetchClasses();
      
      setTimeout(() => {
        setIsClassModalOpen(false);
        setClassStatus(prev => ({...prev, success: false}));
      }, 2000);
    } catch (err) {
      setClassStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleDeleteGroup = async (group, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this assignment for all students?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const assignment_ids = group.students.map(s => s.id);
      const res = await fetch('http://localhost:3001/api/assignments/bulk', {
         method: 'DELETE',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({ assignment_ids })
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchAssignments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateDueDate = async (e) => {
    e.preventDefault();
    setEditStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const assignment_ids = editGroupData.students.map(s => s.id);
      // Ensure empty strings are sent as null for DB
      const due_date = editGroupData.new_due_date ? editGroupData.new_due_date : null;
      const res = await fetch('http://localhost:3001/api/assignments/bulk', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({ assignment_ids, due_date })
      });
      if (!res.ok) throw new Error('Failed to update due date');
      setEditStatus({ loading: false, error: null, success: true });
      fetchAssignments();
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditStatus(prev => ({...prev, success: false}));
        setEditGroupData(null);
      }, 1500);
    } catch (err) {
      setEditStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterStatus({ loading: true, error: null, success: false });

    try {
      const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role: 'student' })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to register student');

      setRegisterStatus({ loading: false, error: null, success: true });
      setFormData({ first_name: '', last_name: '', email: '', password: '' });
      fetchClassData(); // Refresh list

      setTimeout(() => {
        setIsModalOpen(false);
        setRegisterStatus(prev => ({ ...prev, success: false }));
      }, 2000);

    } catch (err) {
      setRegisterStatus({ loading: false, error: err.message, success: false });
    }
  };

  const isInactive = (dateString) => {
    if (!dateString) return true;
    const lastActive = new Date(dateString);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastActive < sevenDaysAgo;
  };

  // Helper to aggregate diagnostic tags for the currently filtered students
  const getAggregatedDiagnostics = () => {
    const filteredStudents = students.filter(s => activeClassId === 'all' || s.class_id === activeClassId);
    const tagCounts = {};

    filteredStudents.forEach(student => {
      if (student.all_diagnostic_data) {
        // all_diagnostic_data comes back as string like '["Tag 1"]||["Tag 2", "Tag 1"]' from GROUP_CONCAT
        const tagArrays = student.all_diagnostic_data.split('||');
        tagArrays.forEach(tagsStr => {
          try {
            const tags = JSON.parse(tagsStr);
            if (Array.isArray(tags)) {
              tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
              });
            }
          } catch (e) {
            // Ignore parsing errors for empty or malformed strings
          }
        });
      }
    });

    // Convert to sorted array
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([tag, count]) => ({ tag, count }))
      .slice(0, 10); // Show top 10
  };

  const currentDiagnostics = getAggregatedDiagnostics();
  const filteredStudents = students.filter(s => activeClassId === 'all' || s.class_id === activeClassId);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/dashboard')}>
           <img src="/logo.png" alt="Hayford Logo" className="w-10 h-10 object-contain mx-auto" />
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-none text-lg group-hover:text-slate-700 transition-colors">
              Hayford Global Learning Hub
            </h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
              Instructor Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full border border-slate-200 cursor-pointer"
          >
             <User size={14} className="text-slate-500" />
             <span className="text-xs font-bold text-slate-700">{user.first_name} {user.last_name}</span>
             <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-12 right-0 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 z-50">
               <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <p className="font-bold text-slate-900 text-sm">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
               </div>
               <div className="p-2 space-y-1">
                 <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors text-left">
                   <Settings size={16} /> My Account
                 </button>
                 <a href="mailto:your-email@gmail.com" className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors text-left">
                   <HelpCircle size={16} /> Help & Support
                 </a>
               </div>
               <div className="p-2 border-t border-slate-100">
                 <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left">
                   <LogOut size={16} /> Logout
                 </button>
               </div>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-8 flex gap-8 sticky top-[73px] z-30">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'overview' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Class Overview
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'assignments' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Assignments & Tasks
        </button>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {activeTab === 'overview' ? (
          <>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Class Overview</h2>
            <p className="text-slate-500 font-medium">Monitor your students' progress and identify those needing assistance.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsClassModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-700 font-bold text-sm px-6 py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <PlusCircle size={18} /> Create Class
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-soft hover:bg-slate-950 hover:shadow-glow transition-all flex items-center gap-2"
            >
              <PlusCircle size={18} /> Register Student
            </button>
          </div>
        </div>

        {/* Class Filter Tabs */}
        {classes.length > 0 && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveClassId('all')}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap ${
                activeClassId === 'all' 
                  ? 'bg-slate-900 text-white shadow-soft' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Students
            </button>
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveClassId(c.id)}
                className={`px-5 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap ${
                  activeClassId === c.id 
                    ? 'bg-slate-900 text-white shadow-soft' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.class_name}
              </button>
            ))}
          </div>
        )}

        {classes.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-3xl p-12 bg-white text-center flex flex-col items-center justify-center gap-4 shadow-sm mb-8 mt-4 mx-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <BookOpen size={32} className="text-slate-400" />
              </div>
              <div>
                <h4 className="font-bold text-xl text-slate-900 mb-2">Welcome to your Classroom</h4>
                <p className="text-slate-500 font-medium max-w-md mx-auto mb-6">You haven't set up any classes yet. Create your first class to start adding students and assigning homework.</p>
                <button onClick={() => setIsClassModalOpen(true)} className="bg-slate-900 hover:bg-slate-950 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-soft">
                  Create Your First Class to Get Started
                </button>
              </div>
            </div>
        ) : (
        <>
        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Total Active Students</span>
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{filteredStudents.length}</span>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">At Risk (&gt;7 Days Inactive)</span>
              <span className="text-4xl font-black text-red-500 tracking-tighter">
                {filteredStudents.filter(s => isInactive(s.last_active_date)).length}
              </span>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Class Average Band</span>
              <span className="text-4xl font-black text-amber-600 tracking-tighter">
                 {filteredStudents.filter(s => s.average_band_score).length > 0
                  ? (filteredStudents.reduce((acc, curr) => acc + parseFloat(curr.average_band_score || 0), 0) / filteredStudents.filter(s => s.average_band_score).length).toFixed(1)
                  : 'N/A'
                 }
              </span>
           </div>
        </div>

        {/* Class Diagnostics Heatmap */}
        {currentDiagnostics.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
                <AlertCircle className="text-slate-400" /> Class Diagnostics
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                Top Frequency Errors
              </span>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentDiagnostics.map((item, index) => (
                  <div key={index} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-700">{item.tag}</span>
                    <span className="text-xs font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                      {item.count} {item.count === 1 ? 'Error' : 'Errors'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Class Roster Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2"><Users className="text-slate-400" /> Student Roster</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                  <th className="px-8 py-4">Student</th>
                  <th className="px-8 py-4 text-center">Tasks Completed</th>
                  <th className="px-8 py-4 text-center">Average Score</th>
                  <th className="px-8 py-4">Last Active</th>
                  <th className="px-8 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-slate-400">Loading class data...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-slate-400">No students found in this view.</td></tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr 
                      key={student.id} 
                      onClick={() => window.location.href = `/student/${student.id}`} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{student.first_name} {student.last_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{student.email}</div>
                      </td>
                      <td className="px-8 py-6 text-center text-lg font-bold text-slate-900">{student.assignments_completed}</td>
                      <td className="px-8 py-6 text-center">
                        <span className="font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                          {student.average_band_score ? Number(student.average_band_score).toFixed(1) : '-'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-slate-500 text-sm">
                        {student.last_active_date ? new Date(student.last_active_date).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-8 py-6">
                        {isInactive(student.last_active_date) ? (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
                             <AlertCircle size={14} /> Inactive
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200">
                              Active
                           </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {/* Recent Activity Feed */}
        <div className="mt-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-slate-400" /> Recent Learning Activity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                  <th className="px-8 py-4">Student</th>
                  <th className="px-8 py-4">Submission Date</th>
                  <th className="px-8 py-4">Module Type</th>
                  <th className="px-8 py-4 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="4" className="px-8 py-12 text-center text-slate-400">Loading recent activity...</td></tr>
                ) : recentActivity.length === 0 ? (
                  <tr><td colSpan="4" className="px-8 py-12 text-center text-slate-400">No recent activity found.</td></tr>
                ) : (
                  recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-6 font-bold text-slate-900">
                        {activity.student_first_name} {activity.student_last_name}
                      </td>
                      <td className="px-8 py-6 text-slate-500">
                        {new Date(activity.completed_at).toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900">{activity.module_name}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">{activity.module_type}</div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 font-black rounded-lg border border-green-200">
                          <CheckCircle2 size={14} /> {Number(activity.overall_score).toFixed(1)}
                        </span>
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
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Assignment Engine</h2>
                <p className="text-slate-500 font-medium">Create and manage tasks for your students.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Col */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-black text-lg text-slate-900 tracking-tight mb-6 flex items-center gap-2"><PlusCircle className="text-amber-500" /> New Assignment</h3>
                  
                  <form onSubmit={handleCreateAssignment} className="space-y-4">
                    {assignmentStatus.error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{assignmentStatus.error}</div>}
                    {assignmentStatus.success && <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">Assignment created successfully!</div>}
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Assignment Type</label>
                      <select value={assignmentForm.assignment_type} onChange={e => setAssignmentForm({...assignmentForm, assignment_type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none">
                        <option value="writing">IELTS Task 1 Academic</option>
                        <option value="vocabulary">Vocabulary Builder</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Assign To</label>
                      <select value={assignmentForm.student_id} onChange={e => setAssignmentForm({...assignmentForm, student_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none">
                        <option value="all">All Students</option>
                        {classes.length > 0 && (
                          <optgroup label="Classes">
                            {classes.map(c => <option key={`class_${c.id}`} value={`class_${c.id}`}>{c.class_name}</option>)}
                          </optgroup>
                        )}
                        <optgroup label="Individual Students">
                          {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                        </optgroup>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Due Date & Time</label>
                      <input type="datetime-local" value={assignmentForm.due_date} onChange={e => setAssignmentForm({...assignmentForm, due_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                        {assignmentForm.assignment_type === 'vocabulary' 
                          ? 'Target Words (Comma Separated)*' 
                          : 'Specific Instructions (Optional)'}
                      </label>
                      <textarea 
                        required={assignmentForm.assignment_type === 'vocabulary'}
                        placeholder={assignmentForm.assignment_type === 'vocabulary' 
                          ? 'E.g., intrinsic, mundane, ephemeral' 
                          : 'E.g., Focus on using transition words clearly.'} 
                        value={assignmentForm.instructions} 
                        onChange={e => setAssignmentForm({...assignmentForm, instructions: e.target.value})} 
                        rows={3} 
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      ></textarea>
                    </div>

                    <button disabled={assignmentStatus.loading} type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors disabled:opacity-50 mt-2">
                      {assignmentStatus.loading ? 'Assigning...' : 'Assign Task'}
                    </button>
                  </form>
                </div>
              </div>

              {/* History Col */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2"><FileText className="text-slate-400" /> Active & Past Assignments</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {(() => {
                      if (assignments.length === 0) return <div className="text-center text-slate-400 py-8">No assignments created yet.</div>;
                      
                      // Group assignments by unique properties to show aggregated completion rate
                      const grouped = assignments.reduce((acc, curr) => {
                        const key = `${curr.module_id}-${curr.due_date}-${curr.instructions}`;
                        if (!acc[key]) acc[key] = { ...curr, totalAssigned: 0, completedCount: 0, students: [] };
                        acc[key].totalAssigned++;
                        if (curr.status === 'completed') acc[key].completedCount++;
                        acc[key].students.push(curr);
                        return acc;
                      }, {});

                      return Object.values(grouped).map((group, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-400 transition-colors">
                          <div 
                            className="bg-white p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                            onClick={() => setExpandedAssignmentId(expandedAssignmentId === idx ? null : idx)}
                          >
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-900">
                                {group.assignment_type === 'vocabulary' ? 'Vocabulary Builder' : group.module_name}
                              </h4>
                              <p className="text-sm text-slate-500 mt-1 line-clamp-1">{group.instructions || 'No specific instructions provided.'}</p>
                              <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><Calendar size={14} /> Due: {group.due_date ? new Date(group.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                                {group.assignment_type && (
                                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                                    {group.assignment_type}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-6 shrink-0 ml-6">
                              <div className="flex flex-col items-center justify-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Completion</span>
                                 <span className={`text-xl font-black ${group.completedCount === group.totalAssigned ? 'text-green-600' : 'text-slate-900'}`}>
                                   {group.completedCount} / {group.totalAssigned}
                                 </span>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setEditGroupData({...group, new_due_date: group.due_date || ''}); setIsEditModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Edit Due Date">
                                  <Edit3 size={16} />
                                </button>
                                <button onClick={(e) => handleDeleteGroup(group, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Assignment">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded Student List */}
                          {expandedAssignmentId === idx && (
                            <div className="bg-slate-50 border-t border-slate-200 p-5 animate-in slide-in-from-top-2">
                               <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-200 pb-2">Student Statuses</h5>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {group.students.map(s => (
                                    <div key={s.id} className="bg-white px-4 py-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                                      <span className="font-bold text-sm text-slate-700">{s.student_first_name} {s.student_last_name}</span>
                                      {s.status === 'completed' 
                                        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-200"><CheckCircle2 size={12} /> Done</span>
                                        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-200">Pending</span>
                                      }
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )}


    </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Assignment Modal overlay */}
      {isEditModalOpen && editGroupData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Edit Assignment</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateDueDate} className="p-8 space-y-4">
              {editStatus.error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{editStatus.error}</div>}
              {editStatus.success && <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">Due date updated!</div>}

              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">New Due Date & Time</label>
                <input type="datetime-local" value={editGroupData.new_due_date} onChange={e => setEditGroupData({...editGroupData, new_due_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex gap-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button disabled={editStatus.loading || editStatus.success} type="submit" className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {editStatus.loading && <Loader2 size={16} className="animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Creation Modal overlay */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Create Class</h3>
              <button onClick={() => setIsClassModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateClass} className="p-8 space-y-4">
              {classStatus.error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{classStatus.error}</div>}
              {classStatus.success && <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">Class successfully created!</div>}

              <div className="space-y-1 border-b border-transparent">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Name</label>
                <input required placeholder="E.g., IELTS Prep Focus Group" type="text" value={classFormData.class_name} onChange={e => setClassFormData({...classFormData, class_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <button disabled={classStatus.loading || classStatus.success} type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {classStatus.loading && <Loader2 size={16} className="animate-spin" />}
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration Modal overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Register Student</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRegister} className="p-8 space-y-4">
              {registerStatus.error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">{registerStatus.error}</div>
              )}
              {registerStatus.success && (
                <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">Student successfully registered!</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">First Name</label>
                  <input required type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Last Name</label>
                  <input required type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Email Address</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Assign to Class (Optional)</label>
                <select value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none">
                  <option value="">None (Unassigned)</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Temporary Password</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
              </div>
              
              <div className="pt-4">
                <button disabled={registerStatus.loading || registerStatus.success} type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {registerStatus.loading && <Loader2 size={16} className="animate-spin" />}
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
