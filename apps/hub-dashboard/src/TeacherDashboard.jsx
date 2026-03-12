import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Users, AlertCircle, PlusCircle, Calendar, X, Loader2, FileText, CheckCircle2, ChevronDown, User, Settings, HelpCircle, Trash2, Edit3, Copy, RefreshCw, UserPlus, ArrowUpDown, Shield, Building2, UserCog } from 'lucide-react';
import logo from './assets/logo.png';

const GRAMMAR_PRACTICE_SECTIONS = [
  {
    id: 'l1-interference',
    title: 'L1 Interference Fixes',
    topics: [
      { label: 'Article Usage', topicId: '01_article_usage' },
      { label: 'Countability & Plurals', topicId: '02_countability_and_plurals' },
      { label: 'Pronoun Reference', topicId: '03_pronoun_reference' },
      { label: 'Prepositional Accuracy', topicId: '04_prepositional_accuracy' },
      { label: 'Word Forms', topicId: '05_word_forms' },
    ],
  },
  {
    id: 'academic-foundations',
    title: 'Academic Foundations',
    topics: [
      { label: 'Subject-Verb Agreement', topicId: '06_subject_verb_agreement' },
      { label: 'Tense Consistency', topicId: '07_tense_consistency' },
      { label: 'Present Perfect vs. Past Simple', topicId: '08_present_perfect_vs_past_simple' },
      { label: 'Gerunds vs. Infinitives', topicId: '09_gerunds_vs_infinitives' },
      { label: 'Passive Voice Construction', topicId: '10_passive_voice_construction' },
    ],
  },
  {
    id: 'sentence-complexity',
    title: 'Sentence Complexity',
    topics: [
      { label: 'Sentence Boundaries (Fragments/Comma Splices)', topicId: '11_sentence_boundaries' },
      { label: 'Relative Clauses', topicId: '12_relative_clauses' },
      { label: 'Subordination', topicId: '13_subordination' },
      { label: 'Word Order', topicId: '14_word_order' },
      { label: 'Parallel Structure', topicId: '15_parallel_structure' },
    ],
  },
  {
    id: 'cohesion-register',
    title: 'Cohesion & Register',
    topics: [
      { label: 'Transitional Devices', topicId: '16_transitional_devices' },
      { label: 'Collocations', topicId: '17_collocations' },
      { label: 'Academic Register', topicId: '18_academic_register' },
      { label: 'Nominalization', topicId: '19_nominalization' },
      { label: 'Hedging', topicId: '20_hedging' },
    ],
  },
];

const DEFAULT_ASSIGNMENT_FORM = {
  module_id: 1,
  student_id: 'all',
  class_id: '',
  assignment_type: 'writing',
  writing_task_type: '1',
  grammar_topic_id: '',
  instructions: '',
  due_date: ''
};

const GRAMMAR_TOPIC_LOOKUP = GRAMMAR_PRACTICE_SECTIONS.reduce((acc, section) => {
  for (const topic of section.topics) {
    acc[topic.topicId] = topic.label;
  }
  return acc;
}, {});

export default function TeacherDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [activeClassId, setActiveClassId] = useState('all');
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', password: '', class_id: '' });
  const [classFormData, setClassFormData] = useState({ class_name: '', start_date: '', end_date: '' });
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [editClassStatus, setEditClassStatus] = useState({ loading: false, error: null, success: false });
  const [classToDelete, setClassToDelete] = useState(null);
  const [deleteClassStatus, setDeleteClassStatus] = useState({ loading: false, error: null });
  const [registerStatus, setRegisterStatus] = useState({ loading: false, error: null, success: false });
  const [classStatus, setClassStatus] = useState({ loading: false, error: null, success: false });
  const [isAssignClassModalOpen, setIsAssignClassModalOpen] = useState(false);
  const [assignClassForm, setAssignClassForm] = useState({ email: '', class_id: '' });
  const [assignClassStatus, setAssignClassStatus] = useState({ loading: false, error: null, success: false });
  const [rosterSort, setRosterSort] = useState({ key: 'student', direction: 'asc' });
  const [studentSearch, setStudentSearch] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  const [newTeacherForm, setNewTeacherForm] = useState({ first_name: '', last_name: '', email: '', password: '', institution_id: '' });
  const [createTeacherStatus, setCreateTeacherStatus] = useState({ loading: false, error: null, success: false });
  const [assignments, setAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState(DEFAULT_ASSIGNMENT_FORM);
  const [assignmentStatus, setAssignmentStatus] = useState({ loading: false, error: null, success: false });
  const [expandedAssignmentId, setExpandedAssignmentId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editGroupData, setEditGroupData] = useState(null);
  const [editStatus, setEditStatus] = useState({ loading: false, error: null, success: false });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isGrammarAssignModalOpen, setIsGrammarAssignModalOpen] = useState(false);
  const [grammarAssignTarget, setGrammarAssignTarget] = useState(null);
  const [selectedGrammarTopic, setSelectedGrammarTopic] = useState(null);
  const [expandedGrammarSections, setExpandedGrammarSections] = useState(
    GRAMMAR_PRACTICE_SECTIONS.map((section) => section.id)
  );
  const [grammarAssignStatus, setGrammarAssignStatus] = useState({ loading: false, error: null, success: false });

  // PHASE 4.3: Bulk Actions State
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedAssignments, setSelectedAssignments] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Platform Management state
  const [institutions, setInstitutions] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userEditForm, setUserEditForm] = useState({ role: '', institution_id: '', class_id: '' });
  const [isCreateInstitutionModalOpen, setIsCreateInstitutionModalOpen] = useState(false);
  const [newInstitutionForm, setNewInstitutionForm] = useState({ name: '', address: '', contact_email: '' });
  const [globalUsersSearch, setGlobalUsersSearch] = useState('');
  const [globalUsersPage, setGlobalUsersPage] = useState(1);
  const [globalUsersSort, setGlobalUsersSort] = useState({ key: 'id', direction: 'asc' });
  const USERS_PER_PAGE = 15;
  const [institutionsSearch, setInstitutionsSearch] = useState('');
  const [institutionsPage, setInstitutionsPage] = useState(1);
  const INSTITUTIONS_PER_PAGE = 5;
  
  // Classes Directory state
  const [allClasses, setAllClasses] = useState([]);
  const [classesSearch, setClassesSearch] = useState('');
  const [classesPage, setClassesPage] = useState(1);
  const CLASSES_PER_PAGE = 10;
  const [navigationView, setNavigationView] = useState('dashboard'); // dashboard, institutions, users, classes

  // PHASE 4.3: Bulk Action Handlers
  const handleBulkDeleteStudents = async () => {
    if (selectedStudents.length === 0) return;
    if (!window.confirm(`Delete ${selectedStudents.length} student(s)? This will remove all their data permanently.`)) return;

    setBulkActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/bulk/users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_ids: selectedStudents })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete students');

      alert(`Successfully deleted ${data.deleted_count} student(s)`);
      setSelectedStudents([]);
      fetchClassData();
    } catch (err) {
      alert(err.message || 'Failed to delete students');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDeleteAssignments = async () => {
    if (selectedAssignments.length === 0) return;
    if (!window.confirm(`Delete ${selectedAssignments.length} assignment(s)? This cannot be undone.`)) return;

    setBulkActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/bulk/assignments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assignment_ids: selectedAssignments })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete assignments');

      alert(`Successfully deleted ${data.deleted_count} assignment(s)`);
      setSelectedAssignments([]);
      fetchAssignments();
    } catch (err) {
      alert(err.message || 'Failed to delete assignments');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleAssignmentSelection = (assignmentId) => {
    setSelectedAssignments(prev => 
      prev.includes(assignmentId) ? prev.filter(id => id !== assignmentId) : [...prev, assignmentId]
    );
  };

  const toggleSelectAllStudents = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const handleRemoveStudentFromClass = async (student) => {
    if (!student?.class_id) return;
    if (!window.confirm(`Remove ${student.first_name} ${student.last_name} from their class?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/${student.id}/class`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data = {};
      try {
        data = text && contentType.includes('application/json') ? JSON.parse(text) : {};
      } catch (_) {
        data = {};
      }

      if (!res.ok) throw new Error(data.error || data.msg || (text || 'Failed to remove student from class'));

      fetchClassData();
      fetchClasses();
    } catch (err) {
      alert(err.message || 'Failed to remove student from class');
    }
  };

  const fetchClassData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/scores/class-overview`, {
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
      const res = await fetch(`${apiBase}/api/classes?include_archived=true`, {
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
      const res = await fetch(`${apiBase}/api/scores/recent`, {
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
      const res = await fetch(`${apiBase}/api/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAssignments(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch assignments', err);
    }
  };

  // Platform Management fetch functions
  const fetchInstitutions = async () => {
    if (user.role !== 'super_admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data);
      }
    } catch (err) {
      console.error('Failed to fetch institutions', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  const fetchGlobalUsers = async () => {
    if (user.role !== 'super_admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Global Users fetched:', data);
        setGlobalUsers(data);
      } else {
        console.error('Failed to fetch global users - HTTP', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch global users', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  const fetchAllClasses = async () => {
    if (user.role !== 'super_admin' && user.role !== 'admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllClasses(data);
      }
    } catch (err) {
      console.error('Failed to fetch all classes', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userEditForm)
      });

      if (!res.ok) throw new Error('Failed to update user');

      await fetchGlobalUsers();
      setIsUserEditModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err.message || 'Failed to update user');
    }
  };

  const handleCreateInstitution = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newInstitutionForm)
      });

      if (!res.ok) throw new Error('Failed to create institution');

      await fetchInstitutions();
      setIsCreateInstitutionModalOpen(false);
      setNewInstitutionForm({ name: '', address: '', contact_email: '' });
    } catch (err) {
      alert(err.message || 'Failed to create institution');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Permanently delete ${userName}? This will remove all their data including scores, assignments, and progress. This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      alert('User deleted successfully');
      await fetchGlobalUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleDeleteInstitution = async (institutionId, institutionName) => {
    if (!window.confirm(`Permanently delete "${institutionName}"? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions/${institutionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete institution');

      alert('Institution deleted successfully');
      await fetchInstitutions();
    } catch (err) {
      alert(err.message || 'Failed to delete institution');
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchClassData();
    fetchAssignments();
    fetchRecentActivity();
    
    if (user.role === 'super_admin') {
      fetchInstitutions();
      fetchGlobalUsers();
    }
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Re-fetch analytics when teacher returns to this tab (e.g. after student submitted)
  useEffect(() => {
    const refreshTeacherData = () => {
      fetchClassData();
      fetchAssignments();
      fetchRecentActivity();
      fetchClasses();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshTeacherData();
      }
    };

    const onFocus = () => refreshTeacherData();
    const onPageShow = () => refreshTeacherData();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setAssignmentStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const payload = { ...assignmentForm };

      if (payload.assignment_type === 'grammar-practice' && !payload.grammar_topic_id) {
        throw new Error('Please choose a grammar topic for Grammar Practice assignments.');
      }

      if (payload.assignment_type === 'grammar-practice' && !payload.instructions?.trim()) {
        const topicLabel = GRAMMAR_TOPIC_LOOKUP[payload.grammar_topic_id] || payload.grammar_topic_id;
        payload.instructions = `Grammar Practice: ${topicLabel}`;
      }

      if (payload.assignment_type !== 'grammar-practice') {
        payload.grammar_topic_id = null;
      }

      if (payload.assignment_type !== 'writing') {
        payload.writing_task_type = null;
      }
      
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

      const res = await fetch(`${apiBase}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create assignment');
      setAssignmentStatus({ loading: false, error: null, success: true });
      setAssignmentForm(DEFAULT_ASSIGNMENT_FORM);
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
      const res = await fetch(`${apiBase}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(classFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create class');
      
      setClassStatus({ loading: false, error: null, success: true });
      setClassFormData({ class_name: '', start_date: '', end_date: '' });
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
      const res = await fetch(`${apiBase}/api/assignments/bulk`, {
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
      const res = await fetch(`${apiBase}/api/assignments/bulk`, {
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

  const openEditClass = (c) => {
    setEditingClass(c);
    setEditClassStatus({ loading: false, error: null, success: false });
    setIsEditClassModalOpen(true);
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!editingClass) return;
    setEditClassStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/${editingClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          class_name: editingClass.class_name,
          start_date: editingClass.start_date || null,
          end_date: editingClass.end_date || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update class');
      setEditClassStatus({ loading: false, error: null, success: true });
      fetchClasses();
      setTimeout(() => {
        setIsEditClassModalOpen(false);
        setEditingClass(null);
        setEditClassStatus(prev => ({ ...prev, success: false }));
      }, 1500);
    } catch (err) {
      setEditClassStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleDeleteClass = (c) => {
    setClassToDelete(c);
    setDeleteClassStatus({ loading: false, error: null });
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;

    setDeleteClassStatus({ loading: true, error: null });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/${classToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data = {};
      try {
        data = text && contentType.includes('application/json') ? JSON.parse(text) : {};
      } catch (_) {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data.error || data.msg || (text || 'Failed to delete class'));
      }

      fetchClasses();
      if (activeClassId === classToDelete.id) setActiveClassId('all');
      setClassToDelete(null);
      setDeleteClassStatus({ loading: false, error: null });
    } catch (err) {
      setDeleteClassStatus({ loading: false, error: err.message || 'Failed to delete class' });
    }
  };

  const handleAssignToClass = async (e) => {
    e.preventDefault();
    setAssignClassStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/assign-class`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: assignClassForm.email.trim(), class_id: assignClassForm.class_id || null })
      });
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data;
      try {
        data = text && contentType.includes('application/json') ? JSON.parse(text) : {};
      } catch (_) {
        setAssignClassStatus({
          loading: false,
          error: 'Server returned an invalid response. If you use a hosted backend, ensure it is deployed with the latest API (Assign to Class).',
          success: false
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || data.msg || 'Failed to assign student');
      setAssignClassStatus({ loading: false, error: null, success: true });
      setAssignClassForm({ email: '', class_id: '' });
      fetchClassData();
      fetchClasses();
      setTimeout(() => {
        setIsAssignClassModalOpen(false);
        setAssignClassStatus(prev => ({ ...prev, success: false }));
      }, 2000);
    } catch (err) {
      setAssignClassStatus({ loading: false, error: err.message, success: false });
    }
  };

  const handleRefreshOverview = () => {
    fetchClassData();
    fetchAssignments();
    fetchRecentActivity();
    fetchClasses();
  };

  const openGrammarAssignModal = (student) => {
    setGrammarAssignTarget(student);
    setSelectedGrammarTopic(null);
    setGrammarAssignStatus({ loading: false, error: null, success: false });
    setIsGrammarAssignModalOpen(true);
  };

  const toggleGrammarSection = (sectionId) => {
    setExpandedGrammarSections((prev) => (
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    ));
  };

  const handleAssignGrammarPractice = async () => {
    if (!grammarAssignTarget || !selectedGrammarTopic) return;

    setGrammarAssignStatus({ loading: true, error: null, success: false });
    try {
      const token = localStorage.getItem('token');
      const payload = {
        student_id: grammarAssignTarget.id,
        assignment_type: 'grammar-practice',
        grammar_topic_id: selectedGrammarTopic.topicId,
        instructions: `Grammar Practice: ${selectedGrammarTopic.label}`,
      };

      const res = await fetch(`${apiBase}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign grammar practice');

      setGrammarAssignStatus({ loading: false, error: null, success: true });
      fetchAssignments();
      setTimeout(() => {
        setIsGrammarAssignModalOpen(false);
        setGrammarAssignTarget(null);
        setSelectedGrammarTopic(null);
        setGrammarAssignStatus({ loading: false, error: null, success: false });
      }, 900);
    } catch (err) {
      setGrammarAssignStatus({ loading: false, error: err.message || 'Failed to assign grammar practice', success: false });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterStatus({ loading: true, error: null, success: false });

    try {
      const res = await fetch(`${apiBase}/api/auth/register`, {
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

  // PHASE 4.4: Create Teacher Account Handler
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    setCreateTeacherStatus({ loading: true, error: null, success: false });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...newTeacherForm, role: 'teacher' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create teacher account');

      setCreateTeacherStatus({ loading: false, error: null, success: true });
      setNewTeacherForm({ first_name: '', last_name: '', email: '', password: '', institution_id: '' });

      setTimeout(() => {
        setCreateTeacherStatus(prev => ({ ...prev, success: false }));
      }, 3000);

    } catch (err) {
      setCreateTeacherStatus({ loading: false, error: err.message, success: false });
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
    const filteredStudents = students.filter(s =>
      activeClassId === 'all' ? true : activeClassId === 'none' ? !s.class_id : s.class_id === activeClassId
    );
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
      .slice(0, 3); // Top 3 common error types
  };

  const currentDiagnostics = getAggregatedDiagnostics();
  const filteredStudents = students.filter(s => {
    const matchesClass = activeClassId === 'all' ? true : activeClassId === 'none' ? !s.class_id : s.class_id === activeClassId;
    const searchLower = studentSearch.toLowerCase();
    const matchesSearch = !studentSearch || 
      `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(searchLower) ||
      (s.email || '').toLowerCase().includes(searchLower);
    return matchesClass && matchesSearch;
  });
  const classNameById = new Map(classes.map((c) => [c.id, c.class_name]));
  const getClassName = (student) => {
    if (!student.class_id) return 'Unassigned';
    return classNameById.get(student.class_id) || 'Unknown Class';
  };
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (rosterSort.key === 'class') {
      const classA = getClassName(a);
      const classB = getClassName(b);
      const classCompare = classA.localeCompare(classB);
      if (classCompare !== 0) return rosterSort.direction === 'asc' ? classCompare : -classCompare;
    }

    const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
    const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
    const fallbackCompare = nameA.localeCompare(nameB);
    return rosterSort.direction === 'asc' ? fallbackCompare : -fallbackCompare;
  });

  const handleRosterSort = (key) => {
    setRosterSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeClasses = classes.filter(c => !c.end_date || c.end_date >= today);
  const archivedClasses = classes.filter(c => c.end_date && c.end_date < today);
  const unassignedStudents = students.filter(s => !s.class_id);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/dashboard')}>
           <img src={logo} alt="Hayford Logo" onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} className="w-10 h-10 object-contain mx-auto" />
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
                <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded ${
                  user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                  user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                  user.role === 'teacher' ? 'bg-green-100 text-green-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {user.role === 'super_admin' ? 'Super Admin' : 
                   user.role === 'admin' ? 'Admin' : 
                   user.role === 'teacher' ? 'Teacher' : 
                   'Student'}
                </span>
              </div>
              <div className="p-2 space-y-1">
                <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
                  <Settings size={16} /> My Account
                </button>
                <a href="mailto:your-email@gmail.com" className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
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

      {/* Admin/SuperAdmin Navigation Bar */}
      {(user.role === 'admin' || user.role === 'super_admin') && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-700 px-8 py-3 flex gap-6 sticky top-[73px] z-30">
          <button
            onClick={() => setNavigationView('dashboard')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              navigationView === 'dashboard'
                ? 'bg-white text-purple-700 shadow-lg'
                : 'text-white hover:bg-white/20'
            }`}
          >
            Dashboard
          </button>
          {user.role === 'super_admin' && (
            <button
              onClick={() => { setNavigationView('institutions'); fetchInstitutions(); }}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                navigationView === 'institutions'
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              Institutions
            </button>
          )}
          {user.role === 'super_admin' && (
            <button
              onClick={() => { setNavigationView('users'); fetchGlobalUsers(); }}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                navigationView === 'users'
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              Global Users
            </button>
          )}
          <button
            onClick={() => { setNavigationView('classes'); fetchAllClasses(); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              navigationView === 'classes'
                ? 'bg-white text-purple-700 shadow-lg'
                : 'text-white hover:bg-white/20'
            }`}
          >
            Classes Directory
          </button>
        </div>
      )}

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
        {(user.role === 'admin' || user.role === 'super_admin') && (
          <button 
            onClick={() => setActiveTab('institution')}
            className={`py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'institution' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Institution Settings
          </button>
        )}
        {user.role === 'super_admin' && (
          <button 
            onClick={() => setActiveTab('platform')}
            className={`py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'platform' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Platform Management
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Navigation Views for Admin/SuperAdmin */}
        {(user.role === 'admin' || user.role === 'super_admin') && navigationView !== 'dashboard' ? (
          <>
            {/* Classes Directory View */}
            {navigationView === 'classes' && (
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Classes Directory</h2>
                    <p className="text-slate-500 font-medium">
                      {user.role === 'super_admin' ? 'View and manage all classes across all institutions' : 'View and manage classes in your institution'}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
                    <input
                      type="text"
                      placeholder="Search classes by name, teacher, or institution..."
                      value={classesSearch}
                      onChange={e => {
                        setClassesSearch(e.target.value);
                        setClassesPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="p-8">
                    {platformLoading ? (
                      <div className="text-center py-12 text-slate-400">Loading classes...</div>
                    ) : allClasses.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">No classes found.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                              <th className="px-6 py-4">Class Name</th>
                              <th className="px-6 py-4">Teacher</th>
                              {user.role === 'super_admin' && <th className="px-6 py-4">Institution</th>}
                              <th className="px-6 py-4">Students</th>
                              <th className="px-6 py-4">Start Date</th>
                              <th className="px-6 py-4">End Date</th>
                              <th className="px-6 py-4">Class Code</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                            {(() => {
                              const filtered = allClasses.filter(cls => {
                                const searchLower = classesSearch.toLowerCase();
                                return !classesSearch || 
                                  cls.class_name.toLowerCase().includes(searchLower) ||
                                  `${cls.teacher_first_name} ${cls.teacher_last_name}`.toLowerCase().includes(searchLower) ||
                                  (cls.institution_name && cls.institution_name.toLowerCase().includes(searchLower));
                              });
                              
                              const startIdx = (classesPage - 1) * CLASSES_PER_PAGE;
                              const endIdx = startIdx + CLASSES_PER_PAGE;
                              const paginated = filtered.slice(startIdx, endIdx);
                              
                              return paginated.map((cls) => (
                                <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 font-bold text-slate-900">{cls.class_name}</td>
                                  <td className="px-6 py-4 text-slate-600">
                                    {cls.teacher_first_name} {cls.teacher_last_name}
                                  </td>
                                  {user.role === 'super_admin' && (
                                    <td className="px-6 py-4 text-slate-600">{cls.institution_name || 'N/A'}</td>
                                  )}
                                  <td className="px-6 py-4 text-center">
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold">
                                      {cls.student_count || 0}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-500">
                                    {cls.start_date ? new Date(cls.start_date).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="px-6 py-4 text-slate-500">
                                    {cls.end_date ? new Date(cls.end_date).toLocaleDateString() : 'Ongoing'}
                                  </td>
                                  <td className="px-6 py-4">
                                    <code className="bg-purple-100 text-purple-700 px-3 py-1 rounded font-mono text-xs font-bold">
                                      {cls.class_code}
                                    </code>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                        
                        {/* Pagination */}
                        {(() => {
                          const filtered = allClasses.filter(cls => {
                            const searchLower = classesSearch.toLowerCase();
                            return !classesSearch || 
                              cls.class_name.toLowerCase().includes(searchLower) ||
                              `${cls.teacher_first_name} ${cls.teacher_last_name}`.toLowerCase().includes(searchLower) ||
                              (cls.institution_name && cls.institution_name.toLowerCase().includes(searchLower));
                          });
                          const totalPages = Math.ceil(filtered.length / CLASSES_PER_PAGE);
                          
                          if (totalPages <= 1) return null;
                          
                          return (
                            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                              <div className="text-sm text-slate-600">
                                Showing {((classesPage - 1) * CLASSES_PER_PAGE) + 1} - {Math.min(classesPage * CLASSES_PER_PAGE, filtered.length)} of {filtered.length} classes
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setClassesPage(prev => Math.max(1, prev - 1))}
                                  disabled={classesPage === 1}
                                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                                >
                                  Previous
                                </button>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                      key={page}
                                      onClick={() => setClassesPage(page)}
                                      className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                        page === classesPage
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {page}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setClassesPage(prev => Math.min(totalPages, prev + 1))}
                                  disabled={classesPage === totalPages}
                                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Institutions View - moved from Platform Management tab */}
            {navigationView === 'institutions' && user.role === 'super_admin' && (
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Institutions Directory</h2>
                    <p className="text-slate-500 font-medium">Manage all institutions in the platform</p>
                  </div>
                  <button
                    onClick={() => setIsCreateInstitutionModalOpen(true)}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
                  >
                    <PlusCircle size={16} /> Create New Institution
                  </button>
                </div>
                {/* Institutions table content will be rendered here - reuse existing code */}
              </div>
            )}

            {/* Global Users View - moved from Platform Management tab */}
            {navigationView === 'users' && user.role === 'super_admin' && (
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Global Users Directory</h2>
                    <p className="text-slate-500 font-medium">Manage all users across all institutions</p>
                  </div>
                </div>
                {/* Global users table content will be rendered here - reuse existing code */}
              </div>
            )}
          </>
        ) : activeTab === 'overview' ? (
          <>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Class Overview</h2>
            <p className="text-slate-500 font-medium">Monitor your students' progress and identify those needing assistance.</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button 
              onClick={handleRefreshOverview}
              className="bg-white border border-slate-200 text-slate-700 font-bold text-sm px-4 py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
              title="Refresh analytics and student data"
            >
              <RefreshCw size={18} /> Refresh
            </button>
            <button 
              onClick={() => setIsClassModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-700 font-bold text-sm px-6 py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <PlusCircle size={18} /> Create Class
            </button>
            <button 
              onClick={() => setIsAssignClassModalOpen(true)}
              className="bg-white border border-brand-copper text-brand-copper font-bold text-sm px-6 py-3 rounded-xl shadow-sm hover:bg-amber-50 transition-all flex items-center gap-2"
            >
              <UserPlus size={18} /> Assign to Class
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-soft hover:bg-slate-950 hover:shadow-glow transition-all flex items-center gap-2"
            >
              <PlusCircle size={18} /> Register Student
            </button>
          </div>
        </div>

        {/* Class Filter Tabs: Active then Archived */}
        {classes.length > 0 && (
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-wrap">
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
              {unassignedStudents.length > 0 && (
                <button
                  onClick={() => setActiveClassId('none')}
                  className={`px-5 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap ${
                    activeClassId === 'none' 
                      ? 'bg-amber-600 text-white shadow-soft' 
                      : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                  }`}
                  title="Students not in any class"
                >
                  No class ({unassignedStudents.length})
                </button>
              )}
              {activeClasses.map(c => (
                <div key={c.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveClassId(c.id)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap ${
                      activeClassId === c.id 
                        ? 'bg-brand-navy text-white shadow-soft dark:bg-brand-copper dark:text-white' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {c.class_name}
                    {c.class_code && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border ${
                        activeClassId === c.id 
                          ? 'bg-white/20 border-white/30 text-white' 
                          : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
                      }`}>
                        Code: {c.class_code}
                      </span>
                    )}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEditClass(c); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700" title="Edit class"><Edit3 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(c); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete class"><Trash2 size={14} /></button>
                </div>
              ))}
              {archivedClasses.map(c => (
                <div key={c.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveClassId(c.id)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap ${
                      activeClassId === c.id 
                        ? 'bg-slate-600 text-white shadow-soft' 
                        : 'bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {c.class_name}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">Archived</span>
                    {c.class_code && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border bg-slate-100 border-slate-200 text-slate-500">
                        Code: {c.class_code}
                      </span>
                    )}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEditClass(c); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Edit class"><Edit3 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(c); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete class"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
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
                Top 3 Common Error Types
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
            <div className="flex items-center gap-3">
              {selectedStudents.length > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
                  <span className="text-xs font-bold text-amber-700">{selectedStudents.length} selected</span>
                  <button
                    onClick={handleBulkDeleteStudents}
                    disabled={bulkActionLoading}
                    className="text-xs font-bold text-red-600 hover:text-red-700 bg-white px-3 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {bulkActionLoading ? 'Deleting...' : 'Delete Selected'}
                  </button>
                  <button
                    onClick={() => setSelectedStudents([])}
                    className="text-xs font-bold text-slate-600 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
              )}
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 bg-white"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                  <th className="px-4 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={toggleSelectAllStudents}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                  </th>
                  <th className="px-8 py-4">
                    <button onClick={() => handleRosterSort('student')} className="inline-flex items-center gap-1 hover:text-slate-600 transition-colors">
                      Student <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-8 py-4">
                    <button onClick={() => handleRosterSort('class')} className="inline-flex items-center gap-1 hover:text-slate-600 transition-colors">
                      Class Name <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-8 py-4 text-center">Tasks Completed</th>
                  <th className="px-8 py-4 text-center">Average Score</th>
                  <th className="px-8 py-4">Last Active</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="7" className="px-8 py-12 text-center text-slate-400">Loading class data...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan="7" className="px-8 py-12 text-center text-slate-400">No students found in this view.</td></tr>
                ) : (
                  sortedStudents.map((student) => (
                    <tr 
                      key={student.id} 
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-4 py-6">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-8 py-6">
                        <button
                          type="button"
                          onClick={() => navigate(`/student/${student.id}`)}
                          className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors hover:underline"
                        >
                          {student.first_name} {student.last_name}
                        </button>
                        <div className="text-xs text-slate-500 mt-0.5">{student.email}</div>
                      </td>
                      <td className="px-8 py-6 text-slate-600 text-sm font-semibold">{getClassName(student)}</td>
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
                      <td className="px-8 py-6 text-right">
                        <div className="inline-flex flex-col items-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openGrammarAssignModal(student);
                            }}
                            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-900 hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                          >
                            Assign Grammar Practice
                          </button>
                          {student.class_id ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveStudentFromClass(student);
                              }}
                              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                            >
                              Remove from Class
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Unassigned</span>
                          )}
                        </div>
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
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="px-8 py-8 text-center text-slate-400 text-sm">Loading recent activity...</div>
            ) : recentActivity.length === 0 ? (
              <div className="px-8 py-8 text-center text-slate-400 text-sm">No recent activity found.</div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="px-8 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{activity.student_first_name} {activity.student_last_name}</p>
                    <p className="text-xs text-slate-500 truncate">{activity.module_name} · {new Date(activity.completed_at).toLocaleString()}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-black rounded-lg border border-green-200 shrink-0">
                    <CheckCircle2 size={12} /> {Number(activity.overall_score).toFixed(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        </>
        ) : activeTab === 'assignments' ? (
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
                      <select
                        value={assignmentForm.assignment_type}
                        onChange={e => setAssignmentForm({
                          ...assignmentForm,
                          assignment_type: e.target.value,
                          grammar_topic_id: e.target.value === 'grammar-practice' ? assignmentForm.grammar_topic_id : ''
                        })}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      >
                        <option value="writing">IELTS Writing</option>
                        <option value="vocabulary">Vocabulary Builder</option>
                        <option value="grammar-practice">Grammar Practice</option>
                      </select>
                    </div>

                    {assignmentForm.assignment_type === 'writing' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">IELTS Task Type</label>
                        <select
                          value={assignmentForm.writing_task_type}
                          onChange={e => setAssignmentForm({ ...assignmentForm, writing_task_type: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        >
                          <option value="1">Task 1 - Academic Report</option>
                          <option value="2">Task 2 - Essay</option>
                          <option value="both">Both Tasks (Task 1 + Task 2)</option>
                        </select>
                      </div>
                    )}

                    {assignmentForm.assignment_type === 'grammar-practice' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Grammar Topic</label>
                        <select
                          required
                          value={assignmentForm.grammar_topic_id}
                          onChange={e => setAssignmentForm({ ...assignmentForm, grammar_topic_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        >
                          <option value="">Select a grammar topic</option>
                          {GRAMMAR_PRACTICE_SECTIONS.map((section) => (
                            <optgroup key={section.id} label={section.title}>
                              {section.topics.map((topic) => (
                                <option key={topic.topicId} value={topic.topicId}>
                                  {topic.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}

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
                    {selectedAssignments.length > 0 && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
                        <span className="text-xs font-bold text-amber-700">{selectedAssignments.length} selected</span>
                        <button
                          onClick={handleBulkDeleteAssignments}
                          disabled={bulkActionLoading}
                          className="text-xs font-bold text-red-600 hover:text-red-700 bg-white px-3 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {bulkActionLoading ? 'Deleting...' : 'Delete Selected'}
                        </button>
                        <button
                          onClick={() => setSelectedAssignments([])}
                          className="text-xs font-bold text-slate-600 hover:text-slate-700"
                        >
                          Clear
                        </button>
                      </div>
                    )}
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

                      return Object.values(grouped).map((group, idx) => {
                        const groupAssignmentIds = group.students.map(s => s.id);
                        const allSelected = groupAssignmentIds.every(id => selectedAssignments.includes(id));
                        const someSelected = groupAssignmentIds.some(id => selectedAssignments.includes(id));

                        return (
                        <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-400 transition-colors">
                          <div 
                            className="bg-white p-5 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                            onClick={() => setExpandedAssignmentId(expandedAssignmentId === idx ? null : idx)}
                          >
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={el => el && (el.indeterminate = someSelected && !allSelected)}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (allSelected) {
                                  setSelectedAssignments(prev => prev.filter(id => !groupAssignmentIds.includes(id)));
                                } else {
                                  setSelectedAssignments(prev => [...new Set([...prev, ...groupAssignmentIds])]);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0"
                            />
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
                      );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'institution' ? (
          <>
            {/* PHASE 4.4: Institution Settings Tab */}
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Institution Settings</h2>
                <p className="text-slate-500 font-medium">Manage your institution and create teacher accounts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Create Teacher Account Form */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-brand-navy to-slate-800">
                  <h3 className="font-black text-xl text-white tracking-tight flex items-center gap-2">
                    <UserPlus className="text-white" /> Create Teacher Account
                  </h3>
                </div>
                <div className="p-8">
                  <form onSubmit={handleCreateTeacher} className="space-y-4">
                    {createTeacherStatus.error && (
                      <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
                        {createTeacherStatus.error}
                      </div>
                    )}
                    {createTeacherStatus.success && (
                      <div className="p-4 bg-green-50 text-green-700 text-xs font-bold rounded-xl border border-green-100">
                        ✓ Teacher account created successfully!
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">First Name</label>
                        <input
                          required
                          type="text"
                          value={newTeacherForm.first_name}
                          onChange={e => setNewTeacherForm({...newTeacherForm, first_name: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy focus:outline-none"
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Last Name</label>
                        <input
                          required
                          type="text"
                          value={newTeacherForm.last_name}
                          onChange={e => setNewTeacherForm({...newTeacherForm, last_name: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy focus:outline-none"
                          placeholder="Smith"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Email Address</label>
                      <input
                        required
                        type="email"
                        value={newTeacherForm.email}
                        onChange={e => setNewTeacherForm({...newTeacherForm, email: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy focus:outline-none"
                        placeholder="teacher@school.edu"
                      />
                    </div>

                    {user.role === 'super_admin' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                        <select
                          required
                          value={newTeacherForm.institution_id}
                          onChange={e => setNewTeacherForm({...newTeacherForm, institution_id: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy focus:outline-none"
                        >
                          <option value="">Select Institution</option>
                          {institutions.map(inst => (
                            <option key={inst.id} value={inst.id}>{inst.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Temporary Password</label>
                      <input
                        required
                        type="password"
                        value={newTeacherForm.password}
                        onChange={e => setNewTeacherForm({...newTeacherForm, password: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy focus:outline-none"
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-slate-500 mt-1">The teacher should change this password after first login.</p>
                    </div>

                    <button
                      disabled={createTeacherStatus.loading}
                      type="submit"
                      className="w-full bg-brand-navy text-white font-black py-3 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 mt-4 shadow-lg"
                    >
                      {createTeacherStatus.loading ? 'Creating Account...' : 'Create Teacher Account'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Institution Info */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
                    <Shield className="text-slate-400" /> Institution Information
                  </h3>
                </div>
                <div className="p-8 space-y-6">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <BookOpen className="text-amber-600" size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-lg text-slate-900 mb-1">Hayford Global Academy</h4>
                        <p className="text-sm text-slate-600 font-medium">Your institution ID: 1</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-sm font-bold text-slate-700">Total Teachers</span>
                      <span className="text-lg font-black text-slate-900">{students.filter(s => s.role === 'teacher').length || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-sm font-bold text-slate-700">Total Students</span>
                      <span className="text-lg font-black text-slate-900">{students.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-sm font-bold text-slate-700">Active Classes</span>
                      <span className="text-lg font-black text-slate-900">{classes?.length || 0}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-900 mb-2">💡 Admin Tip</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Teacher accounts created here will automatically be assigned to your institution. They can create classes and manage students within your organization.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'platform' ? (
          <>
            {/* Platform Management Tab - Super Admin Only */}
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Platform Management</h2>
                <p className="text-slate-500 font-medium">Manage all institutions and users across the platform.</p>
              </div>
            </div>

            {/* Institutions Directory */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
                <h3 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
                  <Building2 className="text-purple-600" /> Institutions Directory
                </h3>
                <button
                  onClick={() => setIsCreateInstitutionModalOpen(true)}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
                >
                  <PlusCircle size={16} /> Create New Institution
                </button>
              </div>
              <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
                <input
                  type="text"
                  placeholder="Search institutions by name..."
                  value={institutionsSearch}
                  onChange={e => {
                    setInstitutionsSearch(e.target.value);
                    setInstitutionsPage(1);
                  }}
                  className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div className="p-8">
                {platformLoading ? (
                  <div className="text-center py-12 text-slate-400">Loading institutions...</div>
                ) : institutions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">No institutions found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Institution Name</th>
                          <th className="px-6 py-4">Contact Email</th>
                          <th className="px-6 py-4">Total Users</th>
                          <th className="px-6 py-4">Created</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                        {(() => {
                          const filtered = institutions.filter(inst => {
                            const searchLower = institutionsSearch.toLowerCase();
                            return !institutionsSearch || inst.name.toLowerCase().includes(searchLower);
                          });
                          
                          const startIdx = (institutionsPage - 1) * INSTITUTIONS_PER_PAGE;
                          const endIdx = startIdx + INSTITUTIONS_PER_PAGE;
                          const paginated = filtered.slice(startIdx, endIdx);
                          
                          return paginated.map((inst) => (
                          <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-purple-600">{inst.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">{inst.name}</td>
                            <td className="px-6 py-4 text-slate-600">{inst.contact_email || 'N/A'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold">
                                {inst.user_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeleteInstitution(inst.id, inst.name)}
                                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    
                    {/* Pagination */}
                    {(() => {
                      const filtered = institutions.filter(inst => {
                        const searchLower = institutionsSearch.toLowerCase();
                        return !institutionsSearch || inst.name.toLowerCase().includes(searchLower);
                      });
                      const totalPages = Math.ceil(filtered.length / INSTITUTIONS_PER_PAGE);
                      
                      if (totalPages <= 1) return null;
                      
                      return (
                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                          <div className="text-sm text-slate-600">
                            Showing {((institutionsPage - 1) * INSTITUTIONS_PER_PAGE) + 1} - {Math.min(institutionsPage * INSTITUTIONS_PER_PAGE, filtered.length)} of {filtered.length} institutions
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setInstitutionsPage(prev => Math.max(1, prev - 1))}
                              disabled={institutionsPage === 1}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  onClick={() => setInstitutionsPage(page)}
                                  className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                    page === institutionsPage
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setInstitutionsPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={institutionsPage === totalPages}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Global Users Directory */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
                  <UserCog className="text-blue-600" /> Global Users Directory
                </h3>
                <p className="text-xs text-slate-600 mt-1">Master list of all users across all institutions</p>
              </div>
              <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={globalUsersSearch}
                  onChange={e => {
                    setGlobalUsersSearch(e.target.value);
                    setGlobalUsersPage(1);
                  }}
                  className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="p-8">
                {platformLoading ? (
                  <div className="text-center py-12 text-slate-400">Loading users...</div>
                ) : globalUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">No users found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                            setGlobalUsersSort(prev => ({
                              key: 'id',
                              direction: prev.key === 'id' && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}>
                            ID {globalUsersSort.key === 'id' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                            setGlobalUsersSort(prev => ({
                              key: 'name',
                              direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}>
                            Name {globalUsersSort.key === 'name' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                            setGlobalUsersSort(prev => ({
                              key: 'email',
                              direction: prev.key === 'email' && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}>
                            Email {globalUsersSort.key === 'email' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                            setGlobalUsersSort(prev => ({
                              key: 'role',
                              direction: prev.key === 'role' && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}>
                            Role {globalUsersSort.key === 'role' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                            setGlobalUsersSort(prev => ({
                              key: 'institution',
                              direction: prev.key === 'institution' && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}>
                            Institution {globalUsersSort.key === 'institution' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                            setGlobalUsersSort(prev => ({
                              key: 'class',
                              direction: prev.key === 'class' && prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}>
                            Class {globalUsersSort.key === 'class' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                        {(() => {
                          const filtered = globalUsers.filter(u => {
                            const searchLower = globalUsersSearch.toLowerCase();
                            return !globalUsersSearch || 
                              `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
                              u.email.toLowerCase().includes(searchLower);
                          });
                          
                          const sorted = [...filtered].sort((a, b) => {
                            let aVal, bVal;
                            if (globalUsersSort.key === 'name') {
                              aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
                              bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
                            } else if (globalUsersSort.key === 'institution') {
                              aVal = (a.institution_name || '').toLowerCase();
                              bVal = (b.institution_name || '').toLowerCase();
                            } else if (globalUsersSort.key === 'class') {
                              aVal = (a.class_name || '').toLowerCase();
                              bVal = (b.class_name || '').toLowerCase();
                            } else {
                              aVal = a[globalUsersSort.key];
                              bVal = b[globalUsersSort.key];
                            }
                            
                            if (aVal < bVal) return globalUsersSort.direction === 'asc' ? -1 : 1;
                            if (aVal > bVal) return globalUsersSort.direction === 'asc' ? 1 : -1;
                            return 0;
                          });
                          
                          const startIdx = (globalUsersPage - 1) * USERS_PER_PAGE;
                          const endIdx = startIdx + USERS_PER_PAGE;
                          const paginated = sorted.slice(startIdx, endIdx);
                          
                          return paginated.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-blue-600">{u.id}</td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{u.first_name} {u.last_name}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded ${
                                u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                u.role === 'teacher' ? 'bg-green-100 text-green-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{u.institution_name || 'None'}</td>
                            <td className="px-6 py-4 text-slate-600">{u.class_name || 'None'}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setUserEditForm({ 
                                      role: u.role, 
                                      institution_id: u.institution_id || '', 
                                      class_id: u.class_id || '' 
                                    });
                                    setIsUserEditModalOpen(true);
                                  }}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)}
                                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    
                    {/* Pagination */}
                    {(() => {
                      const filtered = globalUsers.filter(u => {
                        const searchLower = globalUsersSearch.toLowerCase();
                        return !globalUsersSearch || 
                          `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
                          u.email.toLowerCase().includes(searchLower);
                      });
                      const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE);
                      
                      if (totalPages <= 1) return null;
                      
                      return (
                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                          <div className="text-sm text-slate-600">
                            Showing {((globalUsersPage - 1) * USERS_PER_PAGE) + 1} - {Math.min(globalUsersPage * USERS_PER_PAGE, filtered.length)} of {filtered.length} users
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setGlobalUsersPage(prev => Math.max(1, prev - 1))}
                              disabled={globalUsersPage === 1}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  onClick={() => setGlobalUsersPage(page)}
                                  className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                    page === globalUsersPage
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setGlobalUsersPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={globalUsersPage === totalPages}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* Create Institution Modal */}
      {isCreateInstitutionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-blue-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New Institution</h3>
            </div>
            <form onSubmit={handleCreateInstitution} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution Name</label>
                <input
                  required
                  type="text"
                  value={newInstitutionForm.name}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g., Springfield High School"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Address (Optional)</label>
                <input
                  type="text"
                  value={newInstitutionForm.address}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, address: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="123 Main St, City, State"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Contact Email</label>
                <input
                  required
                  type="email"
                  value={newInstitutionForm.contact_email}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, contact_email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="admin@school.edu"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateInstitutionModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Create Institution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isUserEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Edit User</h3>
              <p className="text-sm text-blue-100 mt-1">{selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})</p>
            </div>
            <form onSubmit={handleUpdateUser} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Role</label>
                <select
                  required
                  value={userEditForm.role}
                  onChange={e => setUserEditForm({...userEditForm, role: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                <select
                  value={userEditForm.institution_id}
                  onChange={e => setUserEditForm({...userEditForm, institution_id: e.target.value, class_id: ''})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">None</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class</label>
                <select
                  value={userEditForm.class_id}
                  onChange={e => setUserEditForm({...userEditForm, class_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  disabled={!userEditForm.institution_id}
                >
                  <option value="">None</option>
                  {classes.filter(c => c.institution_id == userEditForm.institution_id).map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                  ))}
                </select>
                {!userEditForm.institution_id && (
                  <p className="text-xs text-slate-500 mt-1">Select an institution first to assign a class</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGrammarAssignModalOpen && grammarAssignTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black text-2xl text-slate-900 tracking-tight">Assign Grammar Practice</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  {grammarAssignTarget.first_name} {grammarAssignTarget.last_name} · Choose a focused Grammar Lab topic.
                </p>
              </div>
              <button
                onClick={() => setIsGrammarAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                disabled={grammarAssignStatus.loading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              {grammarAssignStatus.error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
                  {grammarAssignStatus.error}
                </div>
              )}
              {grammarAssignStatus.success && (
                <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200">
                  Grammar practice assigned.
                </div>
              )}

              {GRAMMAR_PRACTICE_SECTIONS.map((section) => {
                const isExpanded = expandedGrammarSections.includes(section.id);
                return (
                  <div key={section.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGrammarSection(section.id)}
                      className="w-full px-5 py-4 bg-slate-50 text-left flex items-center justify-between"
                    >
                      <span className="font-black text-sm uppercase tracking-wide text-slate-700">{section.title}</span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white">
                        {section.topics.map((topic) => {
                          const isSelected = selectedGrammarTopic?.topicId === topic.topicId;
                          return (
                            <button
                              key={topic.topicId}
                              type="button"
                              onClick={() => setSelectedGrammarTopic(topic)}
                              className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                                isSelected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <p className="font-bold text-sm leading-tight">{topic.label}</p>
                              <p className={`text-[10px] uppercase tracking-widest mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                topicId: {topic.topicId}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-8 py-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 font-medium">
                {selectedGrammarTopic ? (
                  <span>Selected: <span className="font-bold text-slate-700">{selectedGrammarTopic.label}</span></span>
                ) : (
                  'Select one grammar topic to continue.'
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsGrammarAssignModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                  disabled={grammarAssignStatus.loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignGrammarPractice}
                  disabled={!selectedGrammarTopic || grammarAssignStatus.loading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-950 disabled:opacity-50"
                >
                  {grammarAssignStatus.loading ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-darkBg dark:border dark:border-slate-700 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Delete Class?</h3>
              <p className="text-sm text-slate-500 mt-2">
                Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-200">{classToDelete.class_name}</span>?
              </p>
              <p className="text-xs text-slate-500 mt-1">Students will be unassigned from this class.</p>
            </div>

            <div className="p-8 space-y-4">
              {deleteClassStatus.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-lg border border-red-100 dark:border-red-800">
                  {deleteClassStatus.error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (deleteClassStatus.loading) return;
                    setClassToDelete(null);
                    setDeleteClassStatus({ loading: false, error: null });
                  }}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteClass}
                  disabled={deleteClassStatus.loading}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleteClassStatus.loading && <Loader2 size={16} className="animate-spin" />}
                  Delete Class
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Name</label>
                <input required placeholder="E.g., IELTS Prep Focus Group" type="text" value={classFormData.class_name} onChange={e => setClassFormData({...classFormData, class_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Start Date</label>
                  <input type="date" value={classFormData.start_date} onChange={e => setClassFormData({...classFormData, start_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">End Date</label>
                  <input type="date" value={classFormData.end_date} onChange={e => setClassFormData({...classFormData, end_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Classes with an end date in the past are shown as Archived.</p>
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

      {/* Edit Class Modal */}
      {isEditClassModalOpen && editingClass && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-darkBg dark:border dark:border-slate-700 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Edit Class</h3>
              <button onClick={() => { setIsEditClassModalOpen(false); setEditingClass(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateClass} className="p-8 space-y-4">
              {editClassStatus.error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-lg border border-red-100 dark:border-red-800">{editClassStatus.error}</div>}
              {editClassStatus.success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 text-xs font-bold rounded-lg border border-green-100 dark:border-green-800">Class updated successfully.</div>}
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Name</label>
                <input required type="text" value={editingClass.class_name} onChange={e => setEditingClass({ ...editingClass, class_name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Start Date</label>
                  <input type="date" value={editingClass.start_date ? editingClass.start_date.slice(0, 10) : ''} onChange={e => setEditingClass({ ...editingClass, start_date: e.target.value || null })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">End Date</label>
                  <input type="date" value={editingClass.end_date ? editingClass.end_date.slice(0, 10) : ''} onChange={e => setEditingClass({ ...editingClass, end_date: e.target.value || null })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none text-slate-900 dark:text-white" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Set end date in the past to archive this class.</p>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <button disabled={editClassStatus.loading || editClassStatus.success} type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {editClassStatus.loading && <Loader2 size={16} className="animate-spin" />}
                  Update Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign existing student to class Modal */}
      {isAssignClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-darkBg dark:border dark:border-slate-700 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Assign Student to Class</h3>
              <button onClick={() => { setIsAssignClassModalOpen(false); setAssignClassStatus({ loading: false, error: null, success: false }); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAssignToClass} className="p-8 space-y-4">
              {assignClassStatus.error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-lg border border-red-100 dark:border-red-800">{assignClassStatus.error}</div>}
              {assignClassStatus.success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 text-xs font-bold rounded-lg border border-green-100 dark:border-green-800">Student assigned successfully.</div>}
              <p className="text-xs text-slate-500 dark:text-slate-400">Enter the student&apos;s email to add them to a class (or remove from class).</p>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Student Email</label>
                <input required type="email" placeholder="student@example.com" value={assignClassForm.email} onChange={e => setAssignClassForm({ ...assignClassForm, email: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class</label>
                <select value={assignClassForm.class_id} onChange={e => setAssignClassForm({ ...assignClassForm, class_id: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none text-slate-900 dark:text-white">
                  <option value="">No class (unassign)</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <button disabled={assignClassStatus.loading || assignClassStatus.success} type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {assignClassStatus.loading && <Loader2 size={16} className="animate-spin" />}
                  Assign to Class
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
