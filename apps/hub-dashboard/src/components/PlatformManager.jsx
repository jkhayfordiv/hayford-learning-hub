import React, { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';

const USERS_PER_PAGE = 15;
const INSTITUTIONS_PER_PAGE = 5;
const CLASSES_PER_PAGE = 10;

export default function PlatformManager({ user, apiBase, navigationView, classes, onInstitutionsLoad, onViewClassDetails }) {
  // Platform Management state
  const [institutions, setInstitutions] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userEditForm, setUserEditForm] = useState({ role: '', institution_id: '', class_id: '' });
  const [resetPassword, setResetPassword] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [originalClassIds, setOriginalClassIds] = useState([]);
  const [isCreateInstitutionModalOpen, setIsCreateInstitutionModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [newInstitutionForm, setNewInstitutionForm] = useState({ name: '', address: '', contact_email: '' });
  const [newUserForm, setNewUserForm] = useState({ 
    first_name: '', last_name: '', email: '', password: '', role: 'student', institution_id: '' 
  });
  const [newClassForm, setNewClassForm] = useState({ 
    class_name: '', institution_id: '', teacher_id: '', start_date: '', end_date: '' 
  });
  const [globalUsersSearch, setGlobalUsersSearch] = useState('');
  const [globalUsersPage, setGlobalUsersPage] = useState(1);
  const [globalUsersSort, setGlobalUsersSort] = useState({ key: 'id', direction: 'asc' });
  const [institutionsSearch, setInstitutionsSearch] = useState('');
  const [institutionsPage, setInstitutionsPage] = useState(1);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [isEditInstitutionModalOpen, setIsEditInstitutionModalOpen] = useState(false);
  const [allClasses, setAllClasses] = useState([]);
  const [classesSearch, setClassesSearch] = useState('');
  const [classesPage, setClassesPage] = useState(1);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classEditForm, setClassEditForm] = useState({ class_name: '', class_code: '', institution_id: '', start_date: '', end_date: '' });
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch functions
  const fetchInstitutions = async () => {
    if (user.role !== 'super_admin' && user.role !== 'admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data);
        if (onInstitutionsLoad) onInstitutionsLoad(data);
      }
    } catch (err) {
      console.error('Failed to fetch institutions', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  const fetchGlobalUsers = async () => {
    if (user.role !== 'super_admin' && user.role !== 'admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Users fetched:', data);
        setGlobalUsers(data);
      } else {
        console.error('Failed to fetch users - HTTP', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
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

  // Event handlers
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('token');
      
      // 1. Update user role and institution
      const res = await fetch(`${apiBase}/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userEditForm)
      });

      if (!res.ok) throw new Error('Failed to update user');

      // 2. Reset password if provided
      if (resetPassword && resetPassword.length >= 6) {
        const pwRes = await fetch(`${apiBase}/api/users/${selectedUser.id}/reset-password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ new_password: resetPassword })
        });
        
        if (!pwRes.ok) {
          const pwData = await pwRes.json();
          throw new Error(pwData.error || 'Failed to reset password');
        }
      }

      // 3. Handle class enrollment changes (multi-class support)
      const classesToAdd = selectedClassIds.filter(id => !originalClassIds.includes(id));
      const classesToRemove = originalClassIds.filter(id => !selectedClassIds.includes(id));

      // Enroll in new classes
      for (const classId of classesToAdd) {
        const enrollRes = await fetch(`${apiBase}/api/users/enroll-class`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ email: selectedUser.email, class_id: classId })
        });
        
        if (!enrollRes.ok) {
          const enrollData = await enrollRes.json();
          console.error('Failed to enroll in class:', enrollData.error);
        }
      }

      // Unenroll from removed classes
      for (const classId of classesToRemove) {
        const unenrollRes = await fetch(`${apiBase}/api/users/unenroll-class`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ user_id: selectedUser.id, class_id: classId })
        });
        
        if (!unenrollRes.ok) {
          const unenrollData = await unenrollRes.json();
          console.error('Failed to unenroll from class:', unenrollData.error);
        }
      }

      await fetchGlobalUsers();
      setIsUserEditModalOpen(false);
      setSelectedUser(null);
      setResetPassword('');
      setSelectedClassIds([]);
      setOriginalClassIds([]);
      alert('User updated successfully');
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
  
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newUserForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      alert('User created successfully');
      setIsCreateUserModalOpen(false);
      setNewUserForm({ first_name: '', last_name: '', email: '', password: '', role: 'student', institution_id: '' });
      await fetchGlobalUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newClassForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create class');
      alert('Class created successfully. Code: ' + data.class_code);
      setIsCreateClassModalOpen(false);
      setNewClassForm({ class_name: '', institution_id: '', teacher_id: '', start_date: '', end_date: '' });
      await fetchAllClasses();
    } catch (err) {
      alert(err.message);
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

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!selectedClass) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/${selectedClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(classEditForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update class');

      alert('Class updated successfully');
      setIsEditClassModalOpen(false);
      setSelectedClass(null);
      await fetchAllClasses();
    } catch (err) {
      alert(err.message || 'Failed to update class');
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    if (!window.confirm(`Permanently delete "${selectedClass.class_name}"? This will remove all student enrollments. This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/${selectedClass.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete class');

      alert('Class deleted successfully');
      setIsEditClassModalOpen(false);
      setSelectedClass(null);
      await fetchAllClasses();
    } catch (err) {
      alert(err.message || 'Failed to delete class');
    }
  };

  const searchStudents = async (query) => {
    if (!query || query.trim().length < 2) {
      setStudentSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        // Filter to only show students
        const students = data.filter(u => u.role === 'student');
        setStudentSearchResults(students);
      } else {
        setStudentSearchResults([]);
      }
    } catch (err) {
      console.error('Failed to search students', err);
      setStudentSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStudentToClass = async (student) => {
    if (!selectedClass) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/enroll-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: student.email, class_id: selectedClass.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student to class');

      alert(`${student.first_name} ${student.last_name} added to ${selectedClass.class_name}`);
      setStudentSearchQuery('');
      setStudentSearchResults([]);
      await fetchAllClasses();
    } catch (err) {
      alert(err.message || 'Failed to add student to class');
    }
  };

  // Fetch data when the navigation view changes
  useEffect(() => {
    if (navigationView === 'institutions') fetchInstitutions();
    else if (navigationView === 'users') {
      fetchGlobalUsers();
      fetchInstitutions();
      fetchAllClasses();
    }
    else if (navigationView === 'classes') fetchAllClasses();
  }, [navigationView]);

  return (
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
            <button
              onClick={() => setIsCreateClassModalOpen(true)}
              className="flex items-center gap-2 bg-[#800000] hover:bg-[#600000] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <PlusCircle size={16} /> Create New Class
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <input
                type="text"
                placeholder="Search classes by name, teacher, or institution..."
                value={classesSearch}
                onChange={e => {
                  setClassesSearch(e.target.value);
                  setClassesPage(1);
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-white dark:placeholder-slate-400"
              />
            </div>
            <div className="p-8">
              {platformLoading ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">Loading classes...</div>
              ) : allClasses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">No classes found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black border-b border-slate-200 dark:border-slate-700">
                        <th className="px-6 py-4">Class Name</th>
                        <th className="px-6 py-4">Teacher</th>
                        {user.role === 'super_admin' && <th className="px-6 py-4">Institution</th>}
                        <th className="px-6 py-4">Students</th>
                        <th className="px-6 py-4">Start Date</th>
                        <th className="px-6 py-4">End Date</th>
                        <th className="px-6 py-4">Class Code</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-700">
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
                          <tr key={cls.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4">
                              <button
                                onClick={() => onViewClassDetails && onViewClassDetails(cls.id)}
                                className="font-bold text-slate-900 dark:text-white hover:text-[#800000] dark:hover:text-[#a00000] transition-colors text-left"
                              >
                                {cls.class_name}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {cls.teacher_first_name} {cls.teacher_last_name}
                            </td>
                            {user.role === 'super_admin' && (
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{cls.institution_name || 'N/A'}</td>
                            )}
                            <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-lg font-bold">
                                {cls.student_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                              {cls.start_date ? new Date(cls.start_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                              {cls.end_date ? new Date(cls.end_date).toLocaleDateString() : 'Ongoing'}
                            </td>
                            <td className="px-6 py-4">
                              <code className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1 rounded font-mono text-xs font-bold">
                                {cls.class_code}
                              </code>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedClass(cls);
                                  setClassEditForm({
                                    class_name: cls.class_name,
                                    class_code: cls.class_code,
                                    institution_id: cls.institution_id || '',
                                    start_date: cls.start_date ? cls.start_date.split('T')[0] : '',
                                    end_date: cls.end_date ? cls.end_date.split('T')[0] : ''
                                  });
                                  setStudentSearchQuery('');
                                  setStudentSearchResults([]);
                                  setIsEditClassModalOpen(true);
                                }}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                              >
                                Edit
                              </button>
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

      {/* Institutions View */}
      {navigationView === 'institutions' && user.role === 'super_admin' && (
        <div className="space-y-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Institutions Directory</h2>
              <p className="text-slate-500 font-medium">Manage all institutions in the platform</p>
            </div>
            <button
              onClick={() => setIsCreateInstitutionModalOpen(true)}
              className="flex items-center gap-2 bg-[#800000] hover:bg-[#600000] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <PlusCircle size={16} /> Create New Institution
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <input
                type="text"
                placeholder="Search institutions..."
                value={institutionsSearch}
                onChange={e => {
                  setInstitutionsSearch(e.target.value);
                  setInstitutionsPage(1);
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#800000] focus:outline-none dark:text-white dark:placeholder-slate-400"
              />
            </div>
            <div className="p-8">
              {platformLoading ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">Loading institutions...</div>
              ) : institutions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">No institutions found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black border-b border-slate-200 dark:border-slate-700">
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Contact Email</th>
                        <th className="px-6 py-4 text-center">Total Users</th>
                        <th className="px-6 py-4">Created</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-700">
                      {(() => {
                        const filtered = institutions.filter(inst => {
                          const searchLower = institutionsSearch.toLowerCase();
                          return !institutionsSearch || inst.name.toLowerCase().includes(searchLower);
                        });

                        const startIdx = (institutionsPage - 1) * INSTITUTIONS_PER_PAGE;
                        const endIdx = startIdx + INSTITUTIONS_PER_PAGE;
                        const paginated = filtered.slice(startIdx, endIdx);

                        return paginated.map((inst) => (
                          <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-[#800000] dark:text-[#a00000]">{inst.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{inst.name}</td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{inst.contact_email || 'N/A'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-lg font-bold">
                                {inst.total_users || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                              {inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setSelectedInstitution(inst);
                                    setIsEditInstitutionModalOpen(true);
                                  }}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteInstitution(inst.id, inst.name)}
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
                                    ? 'bg-[#800000] text-white'
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
        </div>
      )}

      {/* Global Users View */}
      {navigationView === 'users' && (user.role === 'super_admin' || user.role === 'admin') && (
        <div className="space-y-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                {user.role === 'super_admin' ? 'Global Users Directory' : 'Users Directory'}
              </h2>
              <p className="text-slate-500 font-medium">
                {user.role === 'super_admin' ? 'Manage all users across all institutions' : 'Manage users in your institution'}
              </p>
            </div>
            <button
              onClick={() => setIsCreateUserModalOpen(true)}
              className="flex items-center gap-2 bg-[#800000] hover:bg-[#600000] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <PlusCircle size={16} /> Create New User
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={globalUsersSearch}
                onChange={e => {
                  setGlobalUsersSearch(e.target.value);
                  setGlobalUsersPage(1);
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#800000] focus:outline-none dark:text-white dark:placeholder-slate-400"
              />
            </div>
            <div className="p-8">
              {platformLoading ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">Loading users...</div>
              ) : globalUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">No users found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black border-b border-slate-200 dark:border-slate-700">
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
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-[#800000] dark:text-[#a00000]">{u.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{u.first_name} {u.last_name}</td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                u.role === 'super_admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                u.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                u.role === 'teacher' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{u.institution_name || 'None'}</td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{u.class_name || 'None'}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    const instId = u.institution_id || '';
                                    setSelectedInstitutionId(instId);
                                    setUserEditForm({
                                      role: u.role,
                                      institution_id: instId,
                                      class_id: u.class_id || ''
                                    });
                                    // Initialize multi-class selection
                                    const userClasses = u.classes || [];
                                    const classIds = userClasses.map(c => c.class_id || c.id);
                                    setSelectedClassIds(classIds);
                                    setOriginalClassIds(classIds);
                                    setResetPassword('');
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
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              let page;
                              if (totalPages <= 5) {
                                page = i + 1;
                              } else if (globalUsersPage <= 3) {
                                page = i + 1;
                              } else if (globalUsersPage >= totalPages - 2) {
                                page = totalPages - 4 + i;
                              } else {
                                page = globalUsersPage - 2 + i;
                              }
                              return (
                                <button
                                  key={page}
                                  onClick={() => setGlobalUsersPage(page)}
                                  className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                    page === globalUsersPage
                                      ? 'bg-[#800000] text-white'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            })}
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
        </div>
      )}

      {/* Create Institution Modal */}
      {isCreateInstitutionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-600 to-blue-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New Institution</h3>
            </div>
            <form onSubmit={handleCreateInstitution} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">Institution Name</label>
                <input
                  required
                  type="text"
                  value={newInstitutionForm.name}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-white dark:placeholder-slate-400"
                  placeholder="e.g., Springfield High School"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">Address (Optional)</label>
                <input
                  type="text"
                  value={newInstitutionForm.address}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, address: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-white dark:placeholder-slate-400"
                  placeholder="123 Main St, City, State"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">Contact Email</label>
                <input
                  required
                  type="email"
                  value={newInstitutionForm.contact_email}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, contact_email: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-white dark:placeholder-slate-400"
                  placeholder="admin@school.edu"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateInstitutionModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-colors"
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
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Edit User</h3>
              <p className="text-sm text-blue-100 mt-1">{selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})</p>
            </div>
            <form onSubmit={handleUpdateUser} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">Role</label>
                <select
                  required
                  value={userEditForm.role}
                  onChange={e => setUserEditForm({...userEditForm, role: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
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
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedInstitutionId(val);
                    setUserEditForm({...userEditForm, institution_id: val, class_id: ''});
                  }}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">None</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Classes (Multi-Select)</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                  {!selectedInstitutionId ? (
                    <p className="text-xs text-slate-500">Select an institution first to assign classes</p>
                  ) : (() => {
                    const filteredClasses = allClasses.filter(c => String(c.institution_id) === String(selectedInstitutionId));
                    if (filteredClasses.length === 0) {
                      return <p className="text-xs text-slate-500">No classes available for this institution</p>;
                    }
                    return filteredClasses.map(cls => (
                      <label key={cls.id} className="flex items-center gap-2 py-2 hover:bg-slate-100 rounded px-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassIds([...selectedClassIds, cls.id]);
                            } else {
                              setSelectedClassIds(selectedClassIds.filter(id => id !== cls.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">{cls.class_name}</span>
                      </label>
                    ));
                  })()}
                </div>
                {selectedClassIds.length > 0 && (
                  <p className="text-xs text-slate-600 mt-1">{selectedClassIds.length} class(es) selected</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Reset Password (Optional)</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Leave blank to keep current password"
                  minLength={6}
                />
                {resetPassword && resetPassword.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-colors"
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

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-600 to-teal-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New User</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">First Name</label>
                  <input
                    required
                    type="text"
                    value={newUserForm.first_name}
                    onChange={e => setNewUserForm({...newUserForm, first_name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Last Name</label>
                  <input
                    required
                    type="text"
                    value={newUserForm.last_name}
                    onChange={e => setNewUserForm({...newUserForm, last_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Email Address</label>
                <input
                  required
                  type="email"
                  value={newUserForm.email}
                  onChange={e => setNewUserForm({...newUserForm, email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Password</label>
                <input
                  required
                  type="password"
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                    {user.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                  <select
                    value={newUserForm.institution_id}
                    onChange={e => setNewUserForm({...newUserForm, institution_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    disabled={user.role === 'admin'}
                  >
                    <option value="">{user.role === 'admin' ? 'Your Institution' : 'None'}</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-600 to-indigo-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New Class</h3>
            </div>
            <form onSubmit={handleCreateClass} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Name</label>
                <input
                  required
                  type="text"
                  value={newClassForm.class_name}
                  onChange={e => setNewClassForm({...newClassForm, class_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g., IELTS Academic Block A"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                <select
                  required
                  value={newClassForm.institution_id}
                  onChange={e => setNewClassForm({...newClassForm, institution_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  disabled={user.role === 'admin'}
                >
                  <option value="">{user.role === 'admin' ? 'Your Institution' : 'Select Institution'}</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Teacher</label>
                <select
                  required
                  value={newClassForm.teacher_id}
                  onChange={e => setNewClassForm({...newClassForm, teacher_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">Select Teacher</option>
                  {globalUsers.filter(u => u.role === 'teacher' || u.role === 'admin').map(tea => (
                    <option key={tea.id} value={tea.id}>{tea.first_name} {tea.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={newClassForm.start_date}
                    onChange={e => setNewClassForm({...newClassForm, start_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">End Date (Optional)</label>
                  <input
                    type="date"
                    value={newClassForm.end_date}
                    onChange={e => setNewClassForm({...newClassForm, end_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateClassModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {isEditClassModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-600 to-purple-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Edit Class</h3>
              <p className="text-sm text-indigo-100 mt-1">{selectedClass.class_name} ({selectedClass.class_code})</p>
            </div>
            <form onSubmit={handleUpdateClass} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Name</label>
                <input
                  required
                  type="text"
                  value={classEditForm.class_name}
                  onChange={e => setClassEditForm({...classEditForm, class_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Code</label>
                <input
                  required
                  type="text"
                  value={classEditForm.class_code}
                  onChange={e => setClassEditForm({...classEditForm, class_code: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  maxLength={6}
                />
              </div>
              {user.role === 'super_admin' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                  <select
                    required
                    value={classEditForm.institution_id}
                    onChange={e => setClassEditForm({...classEditForm, institution_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Institution</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={classEditForm.start_date}
                    onChange={e => setClassEditForm({...classEditForm, start_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">End Date (Optional)</label>
                  <input
                    type="date"
                    value={classEditForm.end_date}
                    onChange={e => setClassEditForm({...classEditForm, end_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Autocomplete Add Student Feature */}
              <div className="space-y-1 border-t border-slate-200 pt-4">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Add Student to Class</label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={e => {
                      setStudentSearchQuery(e.target.value);
                      searchStudents(e.target.value);
                    }}
                    placeholder="Type student name or email..."
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-3 text-slate-400 text-xs">Searching...</div>
                  )}
                  {studentSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {studentSearchResults.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleAddStudentToClass(student)}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-b-0"
                        >
                          <div className="font-bold text-slate-900 text-sm">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{student.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Start typing to search for students in your institution</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleDeleteClass}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg"
                >
                  Delete Class
                </button>
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditClassModalOpen(false);
                    setSelectedClass(null);
                    setStudentSearchQuery('');
                    setStudentSearchResults([]);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg"
                >
                  Update Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
